/**
 * Storage mapper
 * Implements instant record update with only two methods:
 *   Get - retrieves data from Remote by uniq identifier "name"
 *   Put - send new, null, or updated record to Remote
 * Abstract class
 */
Class.create("Reactive", {

  initialize : function(store){
    this.store = store || $app.db;
    if (this.type === undefined) this.type = this.__className.toLowerCase();
  },

  /**
   * Find record in local storage first
   * If item exists - return it (it is definitely up to date)
   * Else load it
   * @param name unique identifier of record
   * @returns Json data of record
   */
  get : function(got, name, options){
    var self = this;
    got = got || this.update.bind(this)
    options = options || {};
    var onFind = function(data, err){
      if (isServer || (data && !options.force)){
        got(data, err)
      } else {
        delete options.force
        options.SECURE_TOKEN = SECURE_TOKEN;
        $proxy.send("get", self.type, name, options)
      }
    }
    // TODO find by several keys, query chaining, consider options
    // or use uniq id
    var key = Object.isString(name) ? "name" : "id";
    this.store.find(onFind, this.type, key, name)
  },

  /**
   * Saves changes locally first then sync with remote
   * @returns Json public difference in record between previous and current
   */
  put : function(callback, name, content, options){
    var self = this;
    if (isServer){
      var onSave = callback;
    } else {
      var onSave = function(diff){
        options = options || {};
        options.content = diff;
        options.SECURE_TOKEN = SECURE_TOKEN;
        $proxy.send("put", self.type, name, options)
      }
    }

    return this.store.save(onSave, this.type, name, content);
  },

  //@client
  onLoad : function(data){
    var self = this;
    var onSave = function(data){
      self.update(data);
    }
    // Update local storage if Remote Storage has found the record
    if (data.name){
      this.store.save(onSave, this.type, data.name, data);
    } else {
      $modal.error(data);
    }
  },

  //implement in child class
  update : function(){
    logger.error("Update method is not implemented")
  }
})
