var union = jsGen.lib.tools.union,
    intersect = jsGen.lib.tools.intersect,
    IDString = jsGen.lib.json.IDString,
    defautCart = jsGen.lib.json.Cart;

var that = jsGen.dao.db.bind('carts', {

    convertID: function (id) {
        switch (typeof id) {
            case 'string':
                id = id.substring(1);
                id = jsGen.lib.converter(id, 62, IDString);
                return id;
            case 'number':
                id = jsGen.lib.converter(id, 62, IDString);
                while (id.length < 3) {
                    id = '0' + id;
                }
                id = 'C' + id;
                return id;
            default:
                return null;
        }
    },

    getCartsNum: function (callback) {
        callback = callback || jsGen.lib.tools.callbackFn;
        that.count(callback);
    },

    getLatestId: function (callback) {
        callback = callback || jsGen.lib.tools.callbackFn;
        that.findOne({}, {
            sort: {
                _id: -1
            },
            hint: {
                _id: 1
            },
            fields: {
                _id: 1
            }
        }, callback);
    },

    getCartsIndex: function (callback) {
        callback = callback || jsGen.lib.tools.callbackFn;
        that.find({}, {
            sort: {
                _id: 1
            },
            hint: {
                _id: 1
            },
            fields: {
                _id: 1,
                restaurant: 1,
                date: 1,
                tableNumber: 1,
                total: 1,
                needPrint: 1,
                dishes: 1
            }
        }).each(callback);
    },

    getCart: function (_id, callback) {
        callback = callback || jsGen.lib.tools.callbackFn;
        that.findOne({
            _id: _id
        }, {
            sort: {
                _id: -1
            },
            fields: {
                _id: 1,
                restaurant: 1,
                date: 1,
                tableNumber: 1,
                total: 1,
                needPrint: 1,
                dishes: 1
            }
        }, callback);
    },

    setCart: function (cartObj, callback) {
        var setObj = {},
        newObj = {
            restaurant: '',
            date: 0,
            tableNumber: 0,
            total: 0,
            needPrint: true,
            dishes: {
                name: '', 
                quantity: 0,
                price: 0,
                total: 0
            }
        };

        newObj = intersect(newObj, cartObj);
        setObj.$set = newObj;
        if (callback) {
            that.findAndModify({
                _id: cartObj._id
            }, [], setObj, {
                w: 1,
                new: true
            }, callback);
        } else {
            that.update({
                _id: cartObj._id
            }, setObj);
        }
    },

    setNewCart: function (cartObj, callback) {
        var cart = union(defautCart),
            newCart = union(defautCart);
        callback = callback || jsGen.lib.tools.callbackFn;

        newCart = intersect(newCart, cartObj);
        newCart = union(cart, newCart);

        that.getLatestId(function (err, doc) {
            if (err) {
                return callback(err, null);
            }
            if (!doc) {
                newCart._id = 1;
            } else {
                newCart._id = doc._id + 1;
            }
            that.findAndModify({
                _id: newCart._id
            }, [], newCart, {
                w: 1,
                upsert: true,
                new: true
            }, callback);
        });
    },

    delCart: function (_id, callback) {
        callback = callback || jsGen.lib.tools.callbackFn;
        that.remove({
            _id: _id
        }, {
            w: 1
        }, callback);
    },
});

module.exports = {
    convertID: that.convertID,
    getCartsNum: that.getCartsNum,
    getLatestId: that.getLatestId,
    getCartsIndex: that.getCartsIndex,
    getCart: that.getCart,
    setCart: that.setCart,
    setNewCart: that.setNewCart,
    delCart: that.delCart
};
