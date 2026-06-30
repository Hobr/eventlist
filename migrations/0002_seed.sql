INSERT OR IGNORE INTO event_types(name, label, sort) VALUES
    ('comic', '漫展', 10),
    ('doujin', '同人展', 20),
    ('concert', '演唱会', 30),
    ('stage', '舞台剧·2.5次元', 40),
    ('dance', '舞见·宅舞', 50),
    ('ipflash', 'IP主题快闪', 60),
    ('online', '线上活动', 70),
    ('other', '其它', 90);

INSERT OR IGNORE INTO event_scales(name, label, sort) VALUES
    ('small', '小型(地区级)', 10),
    ('mid', '中型(省级)', 20),
    ('large', '大型(全国级)', 30),
    ('mega', '超大型(国际级)', 40);
