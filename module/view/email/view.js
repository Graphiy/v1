/**
 * Description
 */
Class.create("ViewEmail", View, {

	initialize : function($super, oFormObject)
	{
		$super(oFormObject);
		this.actions.get("downloadFileButton").observe('click', function(){
			if(!this.currentFile) return;		
			app.triggerDownload(bootstrap.parameters.get('serverAccess')+'&action=download&file='+this.currentFile);
			return false;
		}.bind(this));
	},
	
	open : function($super, userSelection){
		// Move hidden download form in body, if not already there
		var original = $("emlDownloadAttachmentForm");
		if($("emlDownloadForm")){
			original.remove();
		}else{
			$$("body")[0].insert(original);
			original.id="emlDownloadForm";
			original.setAttribute("id", "emlDownloadForm");
			$("emlDownloadForm").insert(new Element("input", {"type": "hidden", "name": "get_action", "value": "eml_dl_attachment"}));
			$("emlDownloadForm").insert(new Element("input", {"type": "hidden", "name": "file", "value": ""}));
			$("emlDownloadForm").insert(new Element("input", {"type": "hidden", "name": "secure_token", "value": Connection.SECURE_TOKEN}));
			$("emlDownloadForm").insert(new Element("input", {"type": "hidden", "name": "attachment_id", "value": ""}));
		}
		$super(userSelection);
		var fileName = userSelection.getUniqueFileName();
		this.textareaContainer = new Element('div');
		this.contentMainContainer = this.textareaContainer;
		this.textareaContainer.setStyle({width: '100%', overflow: 'auto'});	
		this.element.insert(this.textareaContainer);
		fitHeightToBottom($(this.textareaContainer), $($modal.elementName));
		// LOAD FILE NOW
		this.loadFileContent(fileName);
		if(window.ajxpMobile){
			this.setFullScreen();
			attachMobileScroll(this.textareaContainer, "vertical");
		}		
	},
	
	loadFileContent : function(fileName){
		this.currentFile = fileName;
		var connection = new Connection();
		connection.addParameter('get_action', 'eml_get_xml_structure');
		connection.addParameter('file', fileName);	
		connection.onComplete = function(transp){
			this.parseXmlStructure(transp);
			this.updateTitle(getBaseName(fileName));
		}.bind(this);
		connection2 = new Connection();
		connection2.addParameter('get_action', 'eml_get_bodies');
		connection2.addParameter('file', fileName);	
		connection2.onComplete = function(transp){
			this.parseBodies(transp);
		}.bind(this);
		this.setModified(false);
		this.setOnLoad(this.textareaContainer);
		connection.sendAsync();
		connection2.sendAsync();
	},
		
	
	dlAttachment : function(event){
		//console.log(event.target.__ATTACHMENT_ID);
		var form = $("emlDownloadForm");
		form.elements["secure_token"].value = Connection.SECURE_TOKEN;
		form.elements["file"].value = this.currentFile; 
		form.elements["attachment_id"].value = event.target.up("div").__ATTACHMENT_ID;
		form.submit();
	},
	
	cpAttachment : function(event){
		var container = this.element.down('#treeSelectorCpContainer');
		this.treeSelector = new TreeSelector(container);
		var user = app.user;
		if(user) var activeRepository = user.getActiveRepository();
		if(user && user.canCrossRepositoryCopy() && user.hasCrossRepositories()){
			var firstKey ;
			var reposList = new Hash();
			user.getCrossRepositories().each(function(pair){
				if(!firstKey) firstKey = pair.key;
				reposList.set(pair.key, pair.value.getLabel());								
			}.bind(this));
			if(!user.canWrite()){
				var provider = new RemoteNodeProvider({tmp_repository_id: firstKey});
				var rootNode = new AjxpNode("/", false, I18N[373], "folder.png", provider);								
				this.treeSelector.load(rootNode);
			}else{
				this.treeSelector.load();								
			}
			this.treeSelector.setFilterShow(true);							
			reposList.each(function(pair){
				this.treeSelector.appendFilterValue(pair.key, pair.value);
			}.bind(this)); 
			if(user.canWrite()) this.treeSelector.appendFilterValue(activeRepository, "&lt;"+I18N[372]+"&gt;", 'top');
			this.treeSelector.setFilterSelectedIndex(0);
			this.treeSelector.setFilterChangeCallback(function(e){
				externalRepo = this.filterSelector.getValue();
				var provider = new ItemProvider({tmp_repository_id: externalRepo});
				this.resetAjxpRootNode(new AjxpNode("/", false, I18N[373], "folder.png", provider));
			});
		}else{
			this.treeSelector.load();
		}				
		//this.treeSelector.load();
		var currentAtt = event.target.up("div");
		var attachmentId = currentAtt.__ATTACHMENT_ID;
		if(this.fullScreenMode){
			container.setStyle({right: 4, top: ($('emlHeaderContainer').getHeight() + 128) + "px"});	
		}else{
			container.setStyle({right: 11, top: ($('emlHeaderContainer').getHeight() + 75) + "px"});
		}
		
		
		var hideSelector = function(){
			this.treeSelector.unload();
			currentAtt.removeClassName("active");
			currentAtt.select("a.emlAttachmentAction").each(Element.hide);
			container.hide();			
		}.bind(this);
		
		container.down("#eml_cp_ok").observeOnce("click", function(e){
			Event.stop(e);
			var selectedNode = this.treeSelector.getSelectedNode();
			var actionValue = "eml_cp_attachment";
			var crossCopy = false;
			var crtRepoType = app.user.repositories.get(app.user.activeRepository).accessType;
			if(activeRepository && this.treeSelector.getFilterActive(activeRepository)){
				crossCopy = true;
			}
			var connection = new Connection();
			if(crtRepoType == "imap"){
				connection.setParameters({
					file: this.currentFile+"#attachments/"+attachmentId,
					get_action: crossCopy ? "cross_copy" : "copy",
					dest: selectedNode,
					dest_repository_id: crossCopy ? this.treeSelector.filterSelector.getValue() : ""
				});				
			}else{
				connection.setParameters({
					file: this.currentFile,
					get_action: "eml_cp_attachment",
					attachment_id: attachmentId,
					destination: selectedNode,
					dest_repository_id: this.treeSelector.filterSelector.getValue()
				});
                console.log(connection._parameters);
			}
			connection.onComplete = function(transport){
				app.actionBar.parseXmlMessage(transport.responseXML);
			};
			connection.sendAsync();
			hideSelector();
		}.bind(this));
		container.down("#eml_cp_can").observeOnce("click", function(e){
			Event.stop(e);
			hideSelector();
		}.bind(this));
		currentAtt.addClassName("active");
		container.show();
	},
	
	parseBodies : function (transport){
		var xmlDoc = transport.responseXML;
		var html = XPathSelectSingleNode(xmlDoc, 'email_body/mimepart[@type="html"]');
		if(html){
			this.iFrame = new Element('iframe');
			this.textareaContainer.insert(this.iFrame);
            this.textareaContainer.setStyle({overflowY: 'hidden'});
			this.iFrameContent = html.firstChild.nodeValue;
			this.iFrame.contentWindow.document.write(this.iFrameContent);
			this.iFrame.setStyle({width: '100%', height: '100%', border: '0px'});
			if(Prototype.Browser.IE){
				this.element.observeOnce("view:exitFSend", function(){
					// Fix IE disappearing elements in Quirks Mode
					$('emlHeaderContainer').setStyle({position: "absolute"});
					this.textareaContainer.setStyle({marginTop: $('emlHeaderContainer').getHeight()});					
				}.bind(this) );				
			}else{
				var reloader = function(){
					this.iFrame.contentWindow.document.write(this.iFrameContent);
				}.bind(this);
				this.element.observe("view:enterFSend", reloader);
				this.element.observe("view:exitFSend", reloader);
			}
		}else{
			var pre = new Element("pre");
			pre.insert(XPathSelectSingleNode(xmlDoc, 'email_body/mimepart[@type="plain"]').firstChild.nodeValue);
			this.textareaContainer.insert(pre);
            this.textareaContainer.setStyle({overflowY: 'auto'});
			pre.setStyle({display: 'block',height: '100%',margin: 0});
		}
	},
	
	parseXmlStructure : function(transport){
		var xmlDoc = transport.responseXML;
		var hContainer = this.element.down("#emlHeaderContainer");
		// PARSE HEADERS
		var headers = XPathSelectNodes(xmlDoc, "email/header");
		var labels = {"From": "editor.eml.1", "To": "editor.eml.2", "Cc": "editor.eml.12", "Date": "editor.eml.4", "Subject": "editor.eml.3"};;
		var searchedHeaders = {"From": [], "To": [], "Cc": [], "Date": [], "Subject": []};
		headers.each(function(el){
			var hName = XPathGetSingleNodeText(el, "headername");
			var hValue = XPathGetSingleNodeText(el, "headervalue");
			if(searchedHeaders[hName]){
				if(hValue.strip() != ''){ 
					searchedHeaders[hName].push(hValue.strip().escapeHTML());
				}
			}
		});
		//console.log(searchedHeaders);
		$H(searchedHeaders).each(function(pair){
			if(pair.value.length){
				var value = pair.value.join(", ");
				var label = I18N[labels[pair.key]];
				hContainer.insert('\
					<div class="emlHeader">\
						<div class="emlHeaderLabel">'+label+'</div>\
						<div class="emlHeaderContent">'+value+'</div>\
					</div>');
			}
		});
		
		// PARSE ATTACHEMENTS
		// Go throught headers and find Content-Disposition: attachment ones
		var allHeaders = XPathSelectNodes(xmlDoc, "//header");
		var attachments = {};
		var id = 0;
		allHeaders.each(function(el){
			var hName = XPathGetSingleNodeText(el, "headername");
			var hValue = XPathGetSingleNodeText(el, "headervalue");
			if(hName != "Content-Disposition" || hValue != "attachment") return;
			var mimepart = el.parentNode;
			var filename = "";
			// Find filename
			var params = XPathSelectNodes(el, "parameter");
			params.each(function(c){
				if(XPathGetSingleNodeText(c, "paramname") == "filename"){
					filename = XPathGetSingleNodeText(c, "paramvalue");
				}
			});
			// Find attachment ID - not always
			var foundId = false;
			allHeaders.each(function(h){
				if(h.parentNode != mimepart) return;
				var siblingName = XPathGetSingleNodeText(h, "headername");
				var siblingValue = XPathGetSingleNodeText(h, "headervalue");
				if(siblingName == "X-Attachment-Id"){
					id = XPathGetSingleNodeText(h, "headervalue");
					foundId = true;
				}
			});
			attachments[id] = filename;
			if(!foundId){
				id = id+1;
			}
		});
		if(Object.keys(attachments).length){
			var attachCont = new Element('div', {id: "attachments_container", className: "emlAttachCont", style: "height: "+($('emlHeaderContainer').getHeight()-14)+"px"});
			hContainer.insert({top: attachCont});
			for(var key in attachments){
				var att = new Element("div", {className: "emlAttachment"});
				att.__ATTACHMENT_ID = key;
				att.insert(attachments[key]);
				attachCont.insert(att);
				
				var dlBut = new Element("a", {
								className: "emlAttachmentAction", 
								title: I18N["editor.eml.10"]+attachments[key]});
				dlBut.update(new Element("img", {
								src: window.THEME.path+'/image/action/16/download_manager.png',
								height: 16,
								width: 16}));
				var cpBut = new Element("a", {className: "emlAttachmentAction", title: I18N["editor.eml.11"]});
				cpBut.update(new Element("img", {
					src: window.THEME.path+'/image/action/16/editcopy.png',
					height: 16,
					width: 16}));				
				att.insert({top: dlBut});
				att.insert({top: cpBut});
				
				dlBut.observe("click", this.dlAttachment.bind(this));
				cpBut.observe("click", this.cpAttachment.bind(this));
				dlBut.hide();cpBut.hide();
				
				att.observe("mouseenter", function(e){
					e.target.select("a.emlAttachmentAction").each(Element.show);
				});
				att.observe("mouseleave", function(e){
					if(e.target.hasClassName("active")) return;
					e.target.select("a.emlAttachmentAction").each(Element.hide);
				});
				if(Prototype.Browser.IE){
					att.observe("mouseenter", function(e){
						e.target.addClassName("ieHover");
					});
					att.observe("mouseleave", function(e){
						e.target.removeClassName("ieHover");
					});
				}
			}		
		}
		
		fitHeightToBottom($(this.textareaContainer), $($modal.elementName));
		this.removeOnLoad(this.textareaContainer);
	},	
	
	attachmentCellRenderer : function(element, item, type){
        if(!element) return;
		if(item.getMetadata().get("eml_attachments") == "0") {
			if(type == "row") element.update('<span class="text_label"> </span>');
			return;
		}
		element.setStyle({
			backgroundImage: 'url("plugins/editor.eml/attach.png")',
			backgroundRepeat: 'no-repeat', 
			backgroundPosition: (type=="thumb" ? '2px 2px': '5px 4px')
		});
		if(type == "row"){
			element.update('<span class="text_label"> </span>');
		}
		element.setAttribute("title", item.getMetadata().get("eml_attachments")+" attachments");
	}
});
