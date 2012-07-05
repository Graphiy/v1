/**
 * Encapsulation of the lightbox script for $modal.windows. Used for alerting user, but
 * also for all popup forms (generic_dialog_box)
 */
Class.create("Modal", {

	/**
	 * @var Boolean Current state of the page. If true, calls the updateLoadingProgress
	 */
	pageLoading: true,
	/**
	 * Constructor
	 */
	initialize: function(){
	},
	/**
	 * Find the forms
	 */
	initForms: function(){
		this.elementName = 'generic_dialog_box';
		this.element = $(this.elementName);
		this.title = this.element.select(".dialogTitle")[0];
		this.dialogContent = this.element.select(".dialogContent")[0];
		this.currentForm;
		this.cachedForms = new Hash();
		this.iframeIndex = 0;	
	},
	
	/**
	 * Compute dialogContent html
	 * @param sTitle String Title of the popup
	 * @param sIconSrc String Source icon
	 */
	prepareHeader: function(sTitle, sIconSrc){
		var hString = "<span class=\"titleString\">";
		if(sIconSrc != "") hString = "<span class=\"titleString\"><img src=\""+sIconSrc.replace('22', '16')+"\" width=\"16\" height=\"16\" align=\"top\"/>&nbsp;";
		var closeBtn = '<img id="$modal.loseBtn" style="cursor:pointer; float:right; margin-top:2px;" src="'+THEME.path+'/image/action/16/window_close.png" />';  
		hString += sTitle + '</span>';
		this.title.update(closeBtn + hString);
	},
	
	/**
	 * Shows a dialog box by getting the form from the hidden_forms
	 * @param sTitle String Title of the box
	 * @param sFormId String Id of the form to use as content
	 * @param fOnLoad Function Callback after the popup is shown, passe the form as argument
	 * @param fOnComplete Function Callback for OK button
	 * @param fOnCancel Function Callback for Cancel button
	 * @param bOkButtonOnly Boolean Wether to hide cancel button
	 * @param skipButtons Boolean Wether to hide all buttons
	 */
	showDialogForm: function(sTitle, sFormId, fOnLoad, fOnComplete, fOnCancel, bOkButtonOnly, skipButtons){
		this.clearContent(this.dialogContent);
		//this.title.innerHTML = sTitle;
		var newForm;
		if($(sFormId).tagName == 'FORM') // WE PASSED A PREFETCHED HIDDEN FORM
		{
			newForm = $(sFormId);
			newForm.show();
		}
		else
		{
			var formDiv = $(sFormId);
			//var formDiv = $('all_forms').select('[id="'+sFormId+'"]')[0];	
			var newForm = document.createElement('form');
			newForm.id = '$modal.action_form';
			newForm.setAttribute('name','$modal.action_form');
			newForm.setAttribute('action', 'cont.php');
			newForm.appendChild(formDiv.cloneNode(true));
			var reloadIFrame = null;
			if($(newForm).getElementsByTagName("iframe")[0])
			{
				reloadIFrame = $(newForm).getElementsByTagName("iframe")[0];
				reloadIFrameSrc = $(newForm).getElementsByTagName("iframe")[0].getAttribute("src");
			}
			if(formDiv.getAttribute('action'))
			{
				var actionField = document.createElement('input');
				actionField.setAttribute('type', 'hidden'); 
				actionField.setAttribute('name', 'get_action'); 
				actionField.setAttribute('value', formDiv.getAttribute('action'));
				newForm.appendChild(actionField);
			}		
		}
		if(!this.cachedForms.get(sFormId) && !skipButtons){
			this.addSubmitCancel(newForm, fOnCancel, bOkButtonOnly);
		}
		this.dialogContent.appendChild(newForm);
		var boxPadding = $(sFormId).getAttribute("box_padding");
		if(!boxPadding) boxPadding = 10;
		this.dialogContent.setStyle({padding: boxPadding+'px'});

		
		if(fOnCancel){
			this.title.select('#$modal.loseBtn')[0].observe("click", function(){fOnCancel(modal.getForm());hideLightBox();});
		}
		else{
			this.title.select('#$modal.loseBtn')[0].observe("click", function(){hideLightBox();});
		}			
		
		if(fOnComplete)	{
			newForm.onsubmit = function(){
				try{
					fOnComplete($modal.getForm());
				}catch(e){
					alert('Unexpected Error : please report!\n'+e);				
				}
				return false;
			};
		}
		else {
			newForm.onsubmit = function(){
				app.actionBar.submitForm($modal.getForm());
				hideLightBox();
				return false;
			};
		}
		this.showContent(this.elementName, 
				$(sFormId).getAttribute("box_width"), 
				$(sFormId).getAttribute("box_height"),
				null,
				($(sFormId).getAttribute("box_resize") && $(sFormId).getAttribute("box_resize") == "true"));
		if($(newForm).select(".dialogFocus").length)
		{
			objToFocus = $(newForm).select(".dialogFocus")[0];
			setTimeout('objToFocus.focus()', 500);
		}
		if($(newForm).select(".replace_rep").length)
		{
			repDisplay = $(newForm).select(".replace_rep")[0];
			repDisplay.innerHTML = app.getContextHolder().getContextNode().getPath();
		}
		if($(newForm).select(".replace_file").length)
		{
			repDisplay = $(newForm).select(".replace_file")[0];
			repDisplay.innerHTML = getBaseName(app.getUserSelection().getUniqueFileName());
		}
		if($(newForm).select('.dialogEnterKey').length && Prototype.Browser.IE){
			$(newForm).select('.dialogEnterKey').each(function(el){
				if(el.enterObserver) return;
				el.observe("keypress", function(event){
					if(event.keyCode == Event.KEY_RETURN){
						newForm.onsubmit();						
					}
				});
				el.enterObserver = true;
			});
		}
		this.currentForm = newForm;
		if(fOnLoad != null)
		{
			fOnLoad(this.currentForm);
			// Reload shadow if the content has changed after the fOnLoad call
			this.refreshDialogAppearance();
		}
		// SAFARI => FORCE IFRAME RELOADING
		if(Prototype.Browser.WebKit && reloadIFrame && reloadIFrameSrc) reloadIFrame.src = reloadIFrameSrc;
	},
	/**
	 * Utility for effectively showing the modal
	 * @param elementName String
	 * @param boxWidth String Width in pixel or in percent
	 * @param boxHeight String Height in pixel or in percent
	 * @param skipShadow Boolean Do not add a shadow
	 */
	showContent: function(elementName, boxWidth, boxHeight, skipShadow, boxAutoResize){
		app.disableShortcuts();
		app.disableNavigation();
		app.blurAll();
		var winWidth = document.viewport.getWidth();
		var winHeight = document.viewport.getHeight();
	
		this.currentListensToWidth = false;
		this.currentListensToHeight = false;
		// WIDTH / HEIGHT
		if(boxWidth != null){
			if(boxWidth.indexOf("%") ==-1 && parseInt(boxWidth) > winWidth){
				boxWidth = '90%';
			}
			if(boxWidth.indexOf('%') > -1){
				percentWidth = parseInt(boxWidth);
				boxWidth = parseInt((winWidth * percentWidth) / 100);
				this.currentListensToWidth = percentWidth;
			}
			$(elementName).setStyle({width: boxWidth+'px'});
		}
		if(boxHeight != null){
			if(boxHeight.indexOf('%') > -1){
				percentHeight = parseInt(boxHeight);
				boxHeight = parseInt((winHeight * percentHeight) / 100);
				this.currentListensToHeight = percentHeight;
			}
			$(elementName).setStyle({height: boxHeight+'px'});
		}else{
			//if (Prototype.Browser.IE){
				//$(elementName).setStyle({height: '1%'});
			//}else{
				$(elementName).setStyle({height: 'auto'});
			//}
		}
		this.refreshDialogPosition();
		if(boxAutoResize && (this.currentListensToWidth || this.currentListensToHeight) ){
			this.currentResizeListener = function(){
				if(this.currentListensToWidth){
					var winWidth = document.viewport.getWidth();
					boxWidth = parseInt((winWidth * this.currentListensToWidth) / 100);
					$(elementName).setStyle({width: boxWidth+'px'});					
				}
				if(this.currentListensToHeight){
					var winHeight = document.viewport.getHeight();
					boxH = parseInt((winHeight * this.currentListensToHeight) / 100);
					$(elementName).setStyle({height: boxH+'px'});
				}
				this.notify("view:resize");
			}.bind(this);
			Event.observe(window, "resize", this.currentResizeListener);
		}else{
            this.currentResizeListener = function(){
                this.refreshDialogPosition();
            }.bind(this);
            Event.observe(window, "resize", this.currentResizeListener);
        }
			
		displayLightBoxById(elementName);
		
		// FORCE ABSOLUTE FOR SAFARI
		$(elementName).style.position = 'absolute';
		// FORCE FIXED FOR FIREFOX
		if (Prototype.Browser.Gecko){					
			$(elementName).style.position = 'fixed';
		}
		else if(Prototype.Browser.IE){
			$$('select').invoke('show');
			// REFRESH PNG IMAGES FOR IE!
			refreshPNGImages(this.dialogContent);			
		}
		
		if(skipShadow) return;
		Shadower.shadow($(elementName), 
			{
				distance: 3,
				angle: 130,
				opacity: 0.5,
				nestedShadows: 3,
				color: '#000000',
				shadowStyle: {display:'block'}
			}, true);
				
	},
	/**
	 * Find an editor using the editorData and initialize it
	 * @param editorData Object
	 */
	openEditorDialog : function(editorData){
		if(!editorData.formId){
			app.displayMessage('ERROR', 'Error, you must define a formId attribute in your &lt;editor&gt; manifest (or set it as openable="false")');
			return;
		}
		var editorKlass = editorData.editorClass;
		$modal.prepareHeader(editorData.text, resolveImageSource(editorData.icon, '/image/action/ICON_SIZE', 16));
		var loadFunc = function(oForm){			
			if(typeof(editorKlass) == "string"){
				app.actionBar.editor = eval('new '+editorKlass+'(oForm)');
			}else{
				app.actionBar.editor = new editorKlass(oForm);
			}
			app.actionBar.editor.open(app.getUserSelection());
			//app.actionBar.editor.resize();
		};
		this.showDialogForm('', editorData.formId, loadFunc, null, null, true, true);			
	},
	/**
	 * Returns the current form, the real one.
	 * @returns HTMLForm
	 */
	getForm: function()	{
		return this.currentForm;
	},
	/**
	 * Refresh position after a window change
	 * @param checkHeight Boolean
	 * @param elementToScroll HTMLElement
	 */
	refreshDialogPosition: function(checkHeight, elementToScroll){
		var winWidth = document.viewport.getWidth();
		var winHeight = document.viewport.getHeight();
        var element = $(this.elementName);
		boxWidth = element.getWidth();
		var boxHeight = element.getHeight();
		
		if(checkHeight && boxHeight > parseInt(winHeight*90/100)){
			var maxHeight = parseInt(winHeight*90/100);
			var crtScrollHeight = elementToScroll.getHeight();
			var crtOffset = boxHeight - crtScrollHeight;
			if(maxHeight > crtOffset){ 
				elementToScroll.setStyle({
					overflow: 'auto',
					height: (maxHeight-crtOffset)+'px'
				});		
				boxHeight = element.getHeight();
			}
		}
		var offsetLeft = parseInt((winWidth - parseInt(boxWidth)) / 2);
		var offsetTop = parseInt(((winHeight - parseInt(boxHeight))/3));
        
        if(element.offsetLeft && element.offsetTop){
            new Effect.Morph($(this.elementName), {
                style: 'top:'+offsetTop+'px;left:'+offsetLeft+'px',
                duration: 0.4,
                afterFinish: this.refreshDialogAppearance.bind(this)
            });
        }else{
            element.setStyle({top: offsetTop+"px",left: offsetLeft+"px"});
            this.refreshDialogAppearance();
        }

	},
	/**
	 * Refresh appearance after the dialog box changed (shadow)
	 */
	refreshDialogAppearance : function(){
		Shadower.shadow($(this.elementName), 
			{
				distance: 4,
				angle: 130,
				opacity: 0.5,
				nestedShadows: 3,
				color: '#000000',
				shadowStyle : {display: 'block'}
			}, true);		
	},
	/**
	 * Clear all content
	 * @param object HTMLElement The current form
	 */
	clearContent: function(object){
		// REMOVE CURRENT FORM, IF ANY
		if(object.select("form").length)
		{
			var oThis = this;
			object.select("form").each(function(currentForm){
				if(currentForm.target == 'hidden_iframe' || currentForm.id=='login_form' || currentForm.id=='user_pref_form'){
					currentForm.hide();
					oThis.cachedForms.set(currentForm.id,true);
				}
				else{
					try{object.removeChild(currentForm);}catch(e){}
				}
			});		
		}	
	},
	/**
	 * Adds buttons to the content
	 * @param oForm HTMLElement Current form
	 * @param fOnCancel Function Callback on cancel
	 * @param bOkButtonOnly Boolean Hide cancel
	 * @param position String Position.insert() allowed key.
	 * @returns HTMLElement
	 */
	addSubmitCancel: function(oForm, fOnCancel, bOkButtonOnly, position){
		var contDiv = new Element('div', {className: 'dialogButtons'});
		var okButton = new Element('input', {
			type: 'image',
			name: (bOkButtonOnly ? 'close' : 'ok'),
			src: THEME.path+'/image/action/22/dialog_'+(bOkButtonOnly ? 'close' : 'ok_apply')+'.png',
			height: 22,
			width: 22,
			title: I18N[48]});
		okButton.addClassName('dialogButton');
		okButton.addClassName('dialogFocus');
		contDiv.insert(okButton);
		if(!bOkButtonOnly)
		{
			var caButton = new Element('input', {
				type: "image",
				name: "can",
				height: 22,
				width: 22,
				src: THEME.path+'/image/action/22/dialog_close.png',
				title: I18N[49],
				className: "dialogButton"
			});
			if(fOnCancel){
				caButton.observe("click",function(e){fOnCancel($modal.getForm());hideLightBox();Event.stop(e);return false;});
			}
			else{
				caButton.observe("click",function(e){hideLightBox();Event.stop(e);return false;});
			}
			contDiv.insert(caButton);
		}	
		if(!position){
			position = 'bottom';
		}
		var obj = {}; 
		obj[position] = contDiv;
		$(oForm).insert(obj);
		oForm.hasButtons = true;
		return contDiv;
	},
	
	/**
	 * Create a simple tooltip
	 * @param element HTMLElement
	 * @param title String
	 */
	simpleTooltip : function(element, title){
		element.observe("mouseover", function(event){
			var x = Event.pointerX(event)+10;
			var y = Event.pointerY(event)+10;
			if(!this.tooltip){
				this.tooltip = new Element("div", {className: "simple_tooltip"});
				$$('body')[0].insert(this.tooltip);
			}
			this.tooltip.update(title);
			this.tooltip.setStyle({top: y+"px",left: x+"px"});
			if(this.tipTimer){
				window.clearTimeout(this.tipTimer);
			}
            element.addClassName("simple_tooltip_observer_active");
			this.tooltip.show();
		}.bind(this) );
		element.observe("mouseout", function(event){
			if(!this.tooltip) return;
			this.tipTimer = window.setTimeout(function(){
				this.tooltip.hide();
			}.bind(this), 200);
            element.removeClassName("simple_tooltip_observer_active");
		}.bind(this) );
        element.addClassName("simple_tooltip_observer");
	},
	/**
	 * Close the Message
	 */
	closeMessageDiv: function(){
		if(this.messageDivOpen)
		{
			new Effect.Fade(this.messageBox);
			this.messageDivOpen = false;
		}
	},
	/**
	 * Timer for automatically closing the message
	 */
	tempoMessageDivClosing: function(){
		this.messageDivOpen = true;
		setTimeout('$modal.closeMessageDiv()', 6000);
	},
	/**
	 * Display a user message (notice or error)
	 * @param messageType String ERROR or SUCCESS
	 * @param message String Content of the message
	 */
	displayMessage: function(messageType, message){
		if(!this.messageBox){
			this.messageBox = new Element("div", {title: I18N[98],id: "message_div",className: "messageBox"});
			$(document.body).insert(this.messageBox);
			this.messageContent = new Element("div", {id: "message_content"});
			this.messageBox.update(this.messageContent);
			this.messageBox.observe("click", this.closeMessageDiv.bind(this));
		}
		message = message.stripScripts();
		message = message.replace(new RegExp("(\\n)", "g"), "<br>");
		if(messageType == "ERROR"){ this.messageBox.removeClassName('logMessage');  this.messageBox.addClassName('errorMessage');}
		else { this.messageBox.removeClassName('errorMessage');  this.messageBox.addClassName('logMessage');}
		this.messageContent.update(message);
		var container = $('list_view');
		if(!container){
			container = $(THEME.element);
		}
		var containerOffset = Position.cumulativeOffset(container);
		var containerDimensions = container.getDimensions();
		var boxHeight = $(this.messageBox).getHeight();
		var topPosition = containerOffset[1] + containerDimensions.height - boxHeight - 20;
		var boxWidth = parseInt(containerDimensions.width * 90/100);
		var leftPosition = containerOffset[0] + parseInt(containerDimensions.width*5/100);
		this.messageBox.setStyle({
			top: topPosition+'px',
			left: leftPosition+'px',
			width: boxWidth+'px'
		});
		if(!Modernizr.borderradius) {
            new Effect.Corner(this.messageBox,"5px");
        }
		new Effect.Appear(this.messageBox);
		this.tempoMessageDivClosing();
	},

	/**
	 * Callback to be called on close
	 * @param func Function
	 */
	setCloseValidation : function(func){
		this.closeValidation = func;
	},
	
	/**
	 * Callback to be called on close
	 * @param func Function
	 */
	setCloseAction: function(func){
		this.closeFunction = func;
	},
	
	/**
	 * Close action. Remove shadow if any, call close callback if any.
	 */
	close: function(){	
		Shadower.deshadow($(this.elementName));
		if(this.closeFunction){
			 this.closeFunction();
			 //this.closeFunction = null;
		}
		if(this.currentResizeListener){
			Event.stopObserving(window, "resize", this.currentResizeListener);
            this.currentResizeListener = null;
		}
	},

	/**
	 * Creates the title label depending on the "modified" status
	 */
	createTitleSpans : function(){
		var crtTitle = $(this.title).select('span.titleString')[0];
		this.filenameSpan = new Element("span", {className: "filenameSpan"});
		crtTitle.insert({bottom: this.filenameSpan});
		
		this.modifSpan = new Element("span", {className: "modifiedSpan"});
		crtTitle.insert({bottom: this.modifSpan});		
	},
	
	setTitle : function (){
		//TODO update view title (from editor)
	},

	showLoader : function(stepCount){
		var bar = this._progressBar = Ext.create('Ext.ProgressBar', {
			renderTo: 'progressBox',
			width: 300,
			text:'Initializing...'
    });
		bar.stepCount = stepCount;
		bar.currentStep = 0;
	},

	/**
	 * Visualize loading process step by step
	 * @param state Integer Current loading step
	 */
	updateLoadingProgress: function(text){	
		var bar = this._progressBar;
		bar.currentStep++;
		bar.updateText(text)
		bar.updateProgress(bar.currentStep/bar.stepCount)
		if (bar.currentStep == bar.stepCount){
			$('progressBox').hide();
			$('loadingOverlay').hide();
		}
	}
});