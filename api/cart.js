var union = jsGen.lib.tools.union,
    intersect = jsGen.lib.tools.intersect,
    checkID = jsGen.lib.tools.checkID,
    MD5 = jsGen.lib.tools.MD5,
    pagination = jsGen.lib.tools.pagination,
    cartCache = jsGen.cache.cart;

cartCache.getP = function (ID, callback) {
    var that = this,
        doc = this.get(ID);
    callback = callback || jsGen.lib.tools.callbackFn;
    if (doc) {
        return callback(null, doc);
    } else {
        jsGen.dao.cart.getCart(ID, function (err, doc) {
            if (doc) {
                that.put(ID, doc);
            }
            return callback(err, doc);
        });
    }
};

jsGen.cache.cartAll = {
    _initTime: 0,
    _index: []
};
var cache = jsGen.cache.cartAll;
cache._update = function (obj) {
    var that = this;
    if (!this[obj._id]) {
        this[obj._id] = {};
        this._index.push(obj._id);
    }
    this[obj._id]._id = obj._id;
    this[obj._id].restaurant = obj.restaurant;
    this[obj._id].date = obj.date;
    this[obj._id].tableNumber = obj.tableNumber;
    this[obj._id].needPrint = obj.needPrint;
    this[obj._id].dishes = obj.dishes;
    this._initTime = Date.now();
    return this;
};
cache._remove = function (ID) {
    var i, that = this;
    if (this[ID]) {
        delete this[ID];
        this._index.splice(i = this._index.indexOf(ID), i >= 0 ? 1 : 0);
        this._initTime = Date.now();
    }
    return this;
};
(function () {
    var that = this;
    jsGen.dao.cart.getCartsIndex(function (err, doc) {
        if (err) {
            throw err;
        }
        if (doc) {
            that._update(doc);
        }
    });
}).call(cache);

function convertCarts(IDArray) {
    var result = [];
    if (!Array.isArray(IDArray)) {
        IDArray = [IDArray];
    }
    for (var i = 0, len = IDArray.length; i < len; i++) {
        if (cache[IDArray[i]]) {
            result.push({
                _id: jsGen.dao.cart.convertID(IDArray[i]),
                cart: cache[IDArray[i]].cart
            });
        }
    }
    return result;
};

function setCart(cartObj, callback) {
    var callback = callback || jsGen.lib.tools.callbackFn;

    function setCache(doc) {
        cache._remove(doc._id);
        cache._update(doc);
        cartCache.put(doc._id, doc);
    };

    if (!cartObj || !cartObj._id || !cache[cartObj._id]) {
        return callback(null, null);
    }

    cache._update(cartObj);
    jsGen.dao.cart.setCart(cartObj, function (err, doc) {
        return callback(err, doc);
    });
};

function filterCarts(cartArray, callback) {
    var carts = [];
    callback = callback || jsGen.lib.tools.callbackFn;

    if (!Array.isArray(cartArray)) {
        cartArray = [cartArray];
    }
    if (cartArray.length === 0) {
        return callback(null, carts);
    }
};

function getCart(req, res, dm) {
    var cart = decodeURI(req.path[2]);
    if (cart[0] === '_') {
        throw jsGen.Err(jsGen.lib.msg.tagNone);
    }
    if (checkID(cart, 'C')) {
        cart = jsGen.dao.cart.convertID(cart);
    }
    if (typeof cart === 'string') {
        cart = cart.toLowerCase();
    }
    if (cache[cart]) {
        cart = cache[cart]._id;
    } else {
        throw jsGen.Err(jsGen.lib.msg.tagNone);
    }

    pagination(req, list, cartCache, dm.intercept(function (doc) {
        return res.sendjson(doc);
    }));
};

function getCarts(req, res, dm) {
     var list,
        n = +req.path[3],
        p = req.getparam.p || req.getparam.page || 1;

    if (n > 0) {
        if (n > 20) {
            n = 20;
        }
        req.getparam = req.getparam || {};
        req.getparam.p = 1;
        req.getparam.n = n;
        list = cache._index.slice(-n);
    } else {
        n = 0;
        p = +p;
        if (!req.session.listPagination) {
            req.session.listPagination = {
                key: 'cart' + cache._initTime
            };
        }
        list = jsGen.cache.pagination.get(req.session.listPagination.key);
        if (!list || (p === 1 && req.session.listPagination.key !== 'cart' + cache._initTime)) {
            req.session.listPagination.key = 'cart' + cache._initTime;
            list = cache._index.slice(0);
            jsGen.cache.pagination.put(req.session.listPagination.key, list);
        }
    }

    pagination(req, list, cartCache, dm.intercept(function (cartsList) {
        cartsList.data.forEach(function (cart) {
            cart._id = jsGen.dao.cart.convertID(cart._id);
        });
        if (cartsList.pagination) {
            union(req.session.listPagination, cartsList.pagination);
        }
        return res.sendjson(cartsList);
    }));
};

function editCarts(req, res, dm) {
    var defaultObj = {
        _id: '',
        restaurant: '',
        date: 0,
        tableNumber: 0,
        total: 0,
        needPrint: true,
        dishes: {
            name: '',
            quantity: 0,
            price: 0
        }
    },
    body = {
        data: []
    },
    cartArray = req.apibody.data;

    if (!cartArray) {
        throw jsGen.Err(jsGen.lib.msg.requestDataErr);
    }
    if (!Array.isArray(cartArray)) {
        cartArray = [cartArray];
    }
    cartArray.reverse();
    next();

    function next() {
        var cartObj;
        if (cartArray.length === 0) {
            return res.sendjson(body);
        }
        cartObj = cartArray.pop();
        if (!cartObj || !cartObj._id) {
            return next();
        }
        cartObj = intersect(union(defaultObj), cartObj);
        cartObj._id = jsGen.dao.tag.convertID(cartObj._id);
        setCart(cartObj, dm.intercept(function (doc) {
            if (doc) {
                doc._id = jsGen.dao.cart.convertID(doc._id);
                body.data.push(doc);
            }
            return next();
        }));
    };
};

function addCart(req, res, dm) {
    var cart = req.apibody;
    delete cart._id;
    cart.date = Date.now();
    console.log("addCart",cart);
    jsGen.dao.cart.setNewCart(cart, dm.intercept(function (doc) {
        if(doc){
            cache._update(doc);
            cartCache.put(doc._id, doc);
        }
        return res.sendjson(doc);
    }));
};

function editCart(req,res,dm) {
    var cart = req.apibody;
    var id = jsGen.dao.cart.convertID(cart._id);
    var newCart = {
        _id: id,
        needPrint: true,
        date: Date.now()
    }

    console.log("editCart",cart);
    cache._update(newCart);
    jsGen.dao.cart.setCart(newCart);
    
    return res.sendjson();
//    jsGen.dao.cart.delCart(id, dm.intercept(function () {
//        cartCache.remove(id);
//        cache._remove(id);
//    }));

    //setCart(cart, dm.intercept(function (doc) {
    //    return res.sendjson(doc);
    //}));
};

function delCart(req, res, dm) {
    var cart = decodeURI(req.path[2]);

    if (cart[0] === '_') {
        throw jsGen.Err(jsGen.lib.msg.tagNone);
    }
    if (checkID(cart, 'C')) {
        cart = jsGen.dao.cart.convertID(cart);
    }
    if (typeof cart === 'string') {
        cart = cart.toLowerCase();
    }
    if (cache[cart]) {
        cart = cache[cart]._id;
    } else {
        throw jsGen.Err(jsGen.lib.msg.tagNone);
    }
    jsGen.dao.cart.delCart(cart, dm.intercept(function () {
        cartCache.remove(cart);
        cache._remove(cart);
        return res.sendjson({
            remove: 'Ok'
        });
    }));
};

function getFn(req, res, dm) {
    switch (req.path[2]) {
    case undefined:
    case 'index':
        return getCarts(req, res, dm);
    default:
        return getCart(req, res, dm);
    }
};

function postFn(req, res, dm) {
    switch (req.path[3]) {
    case undefined:
    case 'index':
        return addCart(req, res, dm);
    case 'admin':
        return editCart(req, res, dm);
    default:
        return res.r404();
    }
};

function deleteFn(req, res, dm) {
    return delCart(req, res, dm);
};

module.exports = {
    GET: getFn,
    POST: postFn,
    DELETE: deleteFn,
    filterCarts: filterCarts,
    setCart: setCart,
    cache: cache,
    convertCarts: convertCarts
};
