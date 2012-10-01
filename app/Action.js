/** 
 * A "Command" object, encapsulating its callbacks, display attributes, etc.
 */
Class.create("Action", {
  __implements : ["Action"],

  __DEFAULT_ICON_PATH : "/image/action/ICON_SIZE",
  
  initialize : function(p){
    //TODO load config on Action initialization
    this.p = Object.extend({
      text: '',
      title: '',
      icon: '',
      hasAccessKey: false,
      accessKey: '',
      subMenu: false,
      subMenuUpdateImage: false,
      subMenuUpdateTitle: false,
      callbackDialogNode: null,
      callback: Prototype.emptyFunction,
      prepareModal: false, 
      formId: undefined, 
      formCode: undefined
    }, p.parameters);
    this.text = t[this.p.text];
    this.title = t[this.p.title];

    this.context = Object.extend({
      selection: true,
      dir: false,
      allowedMimes: $A([]),
      root: true,
      inZip: true,
      recycle: false,
      behaviour: 'hidden',
      actionBar: false,
      actionBarGroup: 'default',
      contextMenu: false,
      widgets: null,
      infoPanel: false      
    }, p.context);
      
    this.selectionContext = Object.extend({     
      dir: false,
      file: true,
      recycle: false,
      behaviour: 'disabled',
      allowedMimes: $A([]),     
      unique: true,
      multipleOnly: false
    }, p.selectionContext);

    this.rightsContext = Object.extend({      
      noUser: true,
      userLogged: true,
      guestLogged: false,
      read: true,
      write: false,
      adminOnly: false
    }, p.rightsContext);

    this.subMenuItems = Object.extend({
      staticItems: null,
      dynamicItems: null,
    }, p.subMenuItems);

    this.elements = new Array();
    this.contextHidden = false;
    this.deny = false;
    if(this.context.subMenu){
      if(!this.p.actionBar){
        alert('Warning, wrong action definition. Cannot use a subMenu if not displayed in the actionBar!');     
      }
    }

  }, 
  
  /**
   * Execute the action code
   */
  apply : function(){
    if(this.deny) return;
    document.fire("app:beforeApply-"+this.p.name);
    window.actionArguments = $A([]);
    if(this.execute) {
      try{
        this.execute();
      }catch(e){
        $app.displayMessage('ERROR', e.message);
      }
    }else if(this.p.callback){
      this.p.callback();
    }
    if(this.p.subMenu && arguments[0] && arguments[0][0]){
      this.notify("submenu_active", arguments[0][0]);
    }
    window.actionArguments = null;
    document.fire("app:afterApply-"+this.p.name);
  },

  // Override in ConcreteCommand
  execute : function(){},

  /**
   * @returns Boolean whether Action has undo method
   */
  canUndo : function(){},
    
  isEnabled : function(){},
  /**
   * Updates the action status on context change
   */
  fireContextChange : function(p){
    //TODO return on required params missing only
    if (Object.keys(p).length < 4) return;
    if(this.onContextChange){
      window.listenerContext = this;
      this.onContextChange();
    }   
    var rightsContext = this.rightsContext;
    if(!rightsContext.noUser && !p.usersEnabled){
      return this.hideForContext();       
    }
    if((rightsContext.userLogged == 'only' && p.user == null) ||
      (rightsContext.guestLogged && rightsContext.guestLogged=='hidden' & p.user!=null && p.user.id=='guest')){
      return this.hideForContext();
    }
    if(rightsContext.userLogged == 'hidden' && p.user != null && !(p.user.id=='guest' && rightsContext.guestLogged && rightsContext.guestLogged=='show') ){
      return this.hideForContext();
    }
    if(rightsContext.adminOnly && (p.user == null || !p.user.isAdmin)){
      return this.hideForContext();
    }
    if(rightsContext.read && p.user != null && !p.user.canRead()){
      return this.hideForContext();
    }
    if(rightsContext.write && p.user != null && !p.user.canWrite()){
      return this.hideForContext();
    }
    if(this.context.allowedMimes.length){
      if( !this.context.allowedMimes.include("*") && !this.context.allowedMimes.include(p.mime)){
        return this.hideForContext();
      }
    }
    if(this.context.recycle){
      if(this.context.recycle == 'only' && !p.isRecycle){
        return this.hideForContext();       
      }
      if(this.context.recycle == 'hidden' && p.isRecycle){
        return this.hideForContext();
      }
    }
    if(!this.context.inZip && p.isInZip){
      return this.hideForContext();
    }
    if(!this.context.root && p.isRoot){
      return this.hideForContext();
    }
    this.showForContext();        
    
  },
    
  /**
   * Upates the action status on selection change
   */
  fireSelectionChange : function(){
    if(this.onSelectionChange){
      window.listenerContext = this;
      this.selectionChange();     
    }
    if(arguments.length < 1 
      || this.contextHidden 
      || !this.context.selection) { 
      return;
    }
    var userSelection = arguments[0];   
    var bSelection = false;
    if(userSelection != null) 
    {     
      bSelection = !userSelection.isEmpty();
      var bUnique = userSelection.isUnique();
      var bFile = userSelection.hasFile();
      var bDir = userSelection.hasDir();
      var bRecycle = userSelection.isRecycle();
    }
    var selectionContext = this.selectionContext;
    if(selectionContext.allowedMimes.size()){
      if(selectionContext.behaviour == 'hidden') this.hide();
      else this.disable();
    }
    if(selectionContext.unique && !bUnique){
      return this.disable();
    }
    if((selectionContext.file || selectionContext.dir) && !bFile && !bDir){
      return this.disable();
    }
    if((selectionContext.dir && !selectionContext.file && bFile) 
      || (!selectionContext.dir && selectionContext.file && bDir)){
      return this.disable();
    }
    if(!selectionContext.recycle && bRecycle){
      return this.disable();
    }
    if((selectionContext.allowedMimes.size() && userSelection && !userSelection.hasMime(selectionContext.allowedMimes) && !selectionContext.allowedMimes.include('*')) 
      && !(selectionContext.dir && bDir)){
      if(selectionContext.behaviour == 'hidden') return this.hide();
      else return this.disable();
    }
    this.show();
    this.enable();
    
  },
    
  /**
   * Creates the submenu items
   */
  buildSubmenuStaticItems : function(){
    var menuItems = [];
    if(this.subMenuItems.staticItems){
      this.subMenuItems.staticItems.each(function(item){
        var itemText = I18N[item.text];
        if(item.hasAccessKey && I18N[item.accessKey]){
          itemText = this.getKeyedText(I18N[item.text], true, I18N[item.accessKey]);
          if(!this.subMenuItems.accessKeys) this.subMenuItems.accessKeys = [];
          this.manager.registerKey(I18N[item.accessKey],this.p.name, item.command);         
        }
        menuItems.push({
          name: itemText,
          alt: I18N[item.title],
          image: resolveImageSource(item.icon, '/image/action/ICON_SIZE', 22),
          isDefault: !!(item.isDefault),
          callback: function(e){this.apply([item]);}.bind(this)
        });
      }, this);
    }
    this.subMenuItems.staticOptions = menuItems;
  },
  
  /**
   * Caches some data for dynamically built menus
   */
  prepareSubmenuDynamicBuilder : function(){    
    this.subMenuItems.dynamicBuilder = function(protoMenu){
      setTimeout(function(){
        if(this.subMenu){
          window.builderContext = this;
          this.subMenu();
          var menuItems = this.builderMenuItems || [];          
        }else{
            var menuItems = [];
            this.subMenuItems.dynamicItems.each(function(item){
              var action = this.manager.actions.get(item['actionId']);
              if(action.deny) return;
            menuItems.push({
              name: action.getKeyedText(),
              alt: action.p.title,
              image: resolveImageSource(action.p.icon, '/image/action/ICON_SIZE', 16),            
              callback: function(e){this.apply();}.bind(action)
            });
            }, this);
        }
          protoMenu.p.menuItems = menuItems;
          protoMenu.refreshList();
      }.bind(this),0);
    }.bind(this);   
  },
  
  /**
   * Refresh icon image source
   * @param newSrc String The image source. Can reference an image library
   */
  setIcon : function(newSrc){
    this.p.icon = newSrc;
    if($(this.p.name +'_button_icon')){
      $(this.p.name +'_button_icon').src = resolveImageSource(this.p.icon, this.__DEFAULT_ICON_PATH, 22);
    }   
  },
  
  /**
   * Refresh the action label
   * @param newLabel String the new label
   * @param newTitle String the new tooltip
   */
  setLabel : function(newLabel, newTitle){
    this.p.text = I18N[newLabel || this.p.text];
    if($(this.p.name+'_button_label')){
      $(this.p.name+'_button_label').update(this.getKeyedText());
    }
    this.p.title = I18N[newTitle || this.p.title];
    if($(this.p.name+'_button_icon')){
      $(this.p.name+'_button_icon').title = this.p.title;
    }
  },
  
  /**
   * Changes show/hide state
   */
  hideForContext : function(){
    this.hide();
    this.contextHidden = true;
  },
  
  /**
   * Changes show/hide state
   */
  showForContext : function(){
    this.show();
    this.contextHidden = false;
  },
  
  /**
   * Changes show/hide state
   * Notifies "hide" Event
   */
  hide : function(){    
    this.deny = true;
    this.notify('hide');
  },
  
  /**
   * Changes show/hide state
   * Notifies "show" Event 
   */
  show : function(){
    this.deny = false;
    this.notify('show');
  },
  
  /**
   * Changes enable/disable state
   * Notifies "disable" Event 
   */
  disable : function(){
    this.deny = true;
    this.notify('disable');
  },
  
  /**
   * Changes enable/disable state
   * Notifies "enable" Event 
   */
  enable : function(){
    this.deny = false;
    this.notify('enable');
  },
  
  /**
   * To be called when removing
   */
  remove : function(){
  },
  
  /**
   * Create a text label with access-key underlined.
   * @param displayString String the label
   * @param hasAccessKey Boolean whether there is an accessKey or not
   * @param accessKey String The key to underline
   * @returns String
   */
  getKeyedText : function(displayString, hasAccessKey, accessKey){}
  
});
