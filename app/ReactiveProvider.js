/**
 * TODO Don't inherit Reactive
 * get & put methods should bind one callback per Model at Proxy
 */
Class.create("ReactiveProvider", Reactive, {

  initialize : function($super){
    // created managed instances
    this._instances = new Hash();
    this._cbs = {}
    $super.apply(this, $A(arguments).slice(1, arguments.length));
  },
  /**
   * @returns Class instantiated record
   */
  getInstance : function(got, name, options){
    var self = this;
    var instance = this._instances.get(name)
    if (instance){
      got(instance)
    } else {
      var cb = function(data){
        var instance = self.instance(data);
        self._instances.set(name, instance);
        got(instance)
      }
      this._cbs[name] = cb
      this.get(null, name, options)
    }
    return instance
  },
  /**
   * @param data Json
   * @returns Class instantiated record
   */
  instance : function(data){
  },

  update : function(data){
    this._cbs[data.name](data)
    delete this._cbs[data.name]
  }
})
