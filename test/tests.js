require(["safe/crypto", "safe/model"], function(crypto, model) {
    module("safe/crypto");

    test("key generation", function() {
        var keyLength = 256, pwd = "password";

        var key = crypto.genKey(pwd, null, keyLength);

        // Make sure key is the right size
        equal(key.key.length, keyLength/32);

        var newKey = crypto.genKey(pwd, key.salt, keyLength);

        // Using the same password and salt should result in the same key
        deepEqual(key.key, newKey.key);
        deepEqual(key.salt, newKey.salt);

        newKey = crypto.genKey(pwd, null, keyLength);

        // A key generated with new salt should turn out differently.
        notDeepEqual(newKey.key, key.key);
    });

    test("encrypt/decrypt roundtrip", function() {
        var pwd = "password", pt = "Hello World!";
        var key = crypto.genKey(pwd);

        var c = crypto.encrypt(key.key, pt);

        // We should get back a _crypto.container_ object
        ok(crypto.container.isPrototypeOf(c));

        // Encrypting the same value twice with the same key should
        // result in two different cipher texts, since a new iv is randomly
        // generated each time
        var newC = crypto.encrypt(key.key, pt);
        notEqual(newC.ct, c.ct);

        // Decrypted value should be equal to the original value
        var dec = crypto.decrypt(key.key, c);

        equal(dec, pt);
    });

    module("safe/model");

    test("insert (private)", function() {
        // Insert single element at the correct position
        var a = model._private.insert([0, 1, 2, 3, 4, 5], "a", 2);
        deepEqual(a, [0, 1, "a", 2, 3, 4, 5]);

        // Insert mutliple elements at the correct position
        var b = model._private.insert([0, 1, 2, 3, 4, 5], ["hello", "world"], 3);
        deepEqual(b, [0, 1, 2, "hello", "world", 3, 4, 5]);

        // For negative indexes, count from the end backwards
        var c = model._private.insert([0, 1, 2, 3, 4, 5], "a", -2);
        deepEqual(c, [0, 1, 2, 3, "a", 4, 5]);

        // Index should default to 0
        var d = model._private.insert([0, 1, 2, 3, 4, 5], "a");
        deepEqual(d, ["a", 0, 1, 2, 3, 4, 5]);

        // An out-of-range index should result in the value being inserted at the end
        var e = model._private.insert([0, 1, 2, 3, 4, 5], "a", 9);
        deepEqual(e, [0, 1, 2, 3, 4, 5, "a"]);
    });

    test("remove (private)", function() {
        // Remove single element
        var a = model._private.remove(["a", "b", "c", "d", "e"], 3);
        deepEqual(a, ["a", "b", "c", "e"]);

        // Remove a range of elements
        var b = model._private.remove(["a", "b", "c", "d", "e"], 1, 3);
        deepEqual(b, ["a", "e"]);

        // If upper bound is smaller then lower bound, ignore it
        var c = model._private.remove(["a", "b", "c", "d", "e"], 1, -1);
        deepEqual(c, ["a", "c", "d", "e"]);

        // If upper bound is bigger than the length of the list, remove everything up to the end
        var d = model._private.remove(["a", "b", "c", "d", "e"], 1, 10);
        deepEqual(d, ["a"]);

        // If lower bound is out-of-range, return a simple copy
        var e = model._private.remove(["a", "b", "c", "d", "e"], 10);
        deepEqual(e, ["a", "b", "c", "d", "e"]);
    });
});