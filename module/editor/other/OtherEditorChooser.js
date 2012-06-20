/*
 * Description
 */
Class.create("OtherEditorChooser", AbstractEditor, {

	initialize: function($super, oFormObject)
	{
		this.element = oFormObject;
	},

    /*
    Not used, reported in activeCondition
    Dynamic patching of app findEditorsForMime, nice!
     */
    patchEditorLoader : function(){
        var original = app.__proto__.findEditorsForMime;
        app.__proto__.findEditorsForMime = function(mime, restrictToPreviewProviders){
            if(this.user && this.user.getPreference("gui_preferences", true) && this.user.getPreference("gui_preferences", true)["other_editor_extensions"]){
                $H(this.user.getPreference("gui_preferences", true)["other_editor_extensions"]).each(function(pair){
                    var editor = this.getActiveExtensionByType("editor").detect(function(ed){
                        return ed.editorClass == pair.value;
                    });
                    if(editor && !$A(editor.mimes).include(pair.key)){
                        editor.mimes.push(pair.key);
                    }
                }.bind(this));
            }
            return original.apply(this, [mime, restrictToPreviewProviders]);
        };
    },
	
	open : function($super, userSelection){
		$super(userSelection);
		var node = userSelection.getUniqueNode();
		var allEditors = this.findActiveEditors(node.getMime());
		var selector = this.element.down('#editor_selector');
        var clearAssocLink = this.element.down('#clear_assoc_link');
        clearAssocLink.observe("click", function(){
            this.clearAssociations(node.getMime());
        }.bind(this) );
        if(window.ajxpMobile){
            attachMobileScroll(selector, "vertical");
        }
		var even = false;
		allEditors.each(function(el){
			if(el.editorClass == "OtherEditorChooser") return;
			var elDiv = new Element('a', {
				href: '#', 
				className: (even ? 'even': ''),
				style: "background-image:url('"+resolveImageSource(el.icon, '/image/action/ICON_SIZE', 22)+"');background-size:22px;"
				}).update(el.text + '<span>'+el.title+'</span>');
			even = !even;
            elDiv.currentMime = node.getMime();
			elDiv.editorData = el;
			elDiv.observe('click', this.selectEditor.bind(this));
			selector.insert(elDiv);
		}.bind(this) );
	},
	
	selectEditor : function(event){
        Event.stop(event);
		if(!event.target.editorData) return;
		app.loadEditorResources(event.target.editorData.resourcesManager);
		hideLightBox();
		modal.openEditorDialog(event.target.editorData);
        this.createAssociation(event.target.currentMime, event.target.editorData.editorClass);
	},

    createAssociation : function(mime, editorClassName){
        var editor = app.getActiveExtensionByType("editor").detect(function(ed){
            return ed.editorClass == editorClassName;
        });
        if(editor && !$A(editor.mimes).include(mime)){
            editor.mimes.push(mime);
            if(app && app.user){
                var guiPrefs = app.user.getPreference("gui_preferences", true) || {};
                var exts = guiPrefs["other_editor_extensions"] || {};
                exts[mime] = editorClassName;
                guiPrefs["other_editor_extensions"] = exts;
                app.user.setPreference("gui_preferences", guiPrefs, true);
                app.user.savePreference("gui_preferences");
            }
        }
    },

    clearAssociations : function(mime){
        try{
            var guiPrefs = app.user.getPreference("gui_preferences", true);
            var assoc = guiPrefs["other_editor_extensions"];
        }catch(e){}
        if(assoc && assoc[mime]){
            var editorClassName = assoc[mime];
            var editor = app.getActiveExtensionByType("editor").detect(function(ed){
                return ed.editorClass == editorClassName;
            });
            if(editor){
                editor.mimes = $A(editor.mimes).without(mime);
            }
            delete assoc[mime];
            guiPrefs["other_editor_extensions"] = assoc;
            app.user.setPreference("gui_preferences", guiPrefs, true);
            app.user.savePreference("gui_preferences");
        }
    },
	
	/**
	 * Find Editors that can handle a given mime type
	 * @param mime String
	 * @returns View[]
	 */
	findActiveEditors : function(mime){
		var editors = $A([]);
		var checkWrite = false;
		if(this.user != null && !this.user.canWrite()){
			checkWrite = true;
		}
		app.getActiveExtensionByType('editor').each(function(el){
			if(checkWrite && el.write) return;
			if(!el.openable) return;
			if(el.mimes.include(mime) || el.mimes.include('*')) return;
			editors.push(el);
		});
		if(editors.length && editors.length > 1){
			editors = editors.sortBy(function(ed){
				return ed.order||0;
			});
		}
		return editors;
	}
});
