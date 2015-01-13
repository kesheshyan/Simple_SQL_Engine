describe('Testing patterns functionality', function () {
  var p = Parser.patterns;
  describe('txt', function () {
    it('should find predefined string', function () {
      expect(p.txt("abc").exec("abc", 0)).toEqual({
        res: "abc",
        end: 3
      });
      expect(p.txt("abc").exec("defabc", 3)).toEqual({
        res: "abc",
        end: 6
      });
      expect(p.txt("abc").exec("def", 0)).toEqual(void 0);
    });
  });

  describe('rgx', function () {
    it('should find regexp', function () {
      expect(p.rgx(/\d+/).exec("123456sdfsdf", 0)).toEqual({
        res: '123456',
        end: 6
      });
      expect(p.rgx(/\d+/).exec("def", 0)).toEqual(void 0);
    });
  });

  describe('opt', function () {
    it('should make some pattern optional', function () {
      expect(p.opt(p.rgx(/\d+/)).exec("123456sdfsdf", 0)).toEqual({
        res: '123456',
        end: 6
      });
      expect(p.opt(p.rgx(/\d+/)).exec("sdfsdf", 0)).toEqual({
        res: void 0,
        end: 0
      });
    });
  });

  describe('any', function () {
    var pan = p.any(p.txt("abc"), p.txt("def"));

    it('should exec at least one pattern', function () {
      expect(pan.exec("abc", 0)).toEqual({
        res: "abc",
        end: 3
      });
      expect(pan.exec("def", 0)).toEqual({
        res: "def",
        end: 3
      });
    });

    it('should exec no patterns', function () {
      expect(pan.exec("ABC", 0)).toEqual(void 0);
    });
  });

  describe('seq', function () {
    var pan = p.seq(p.txt("abc"), p.txt("def"));

    it('should return an array of results', function () {
      expect(pan.exec("abcdef", 0)).toEqual({
        res: ["abc", "def"],
        end: 6
      });
    });

    it('should return nothing', function () {
      expect(pan.exec("abcde7", 0)).toEqual(void 0);
    });
  });

  describe('rep', function () {
    var pan = p.rep(p.rgx(/\d+/), p.txt(","));

    it('should return an array of results', function () {
      expect(pan.exec("1,456,789", 0)).toEqual({
        res: ["1", "456", "789"],
        end: 9
      });
    });

    it('should return an array of results', function () {
      expect(pan.exec("123ABC", 0)).toEqual({
        res: ["123"],
        end: 3
      });
    });

    it('should return nothing', function () {
      expect(pan.exec("abcde7", 0)).toEqual(void 0);
    });
  });
});