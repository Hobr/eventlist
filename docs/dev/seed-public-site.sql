PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO tags(name) VALUES
    ('初音未来'),
    ('同人展'),
    ('舞台剧'),
    ('购票开放'),
    ('漫展'),
    ('东方Project'),
    ('游戏'),
    ('音乐现场'),
    ('IP快闪'),
    ('舞台演出');

INSERT INTO events(
    title, type, scale, division_code, venue, address,
    start_date, end_date, start_time, end_time, cover_url, description,
    qq_group, ticket_url, source_url, submitter_contact, status, published_at
)
SELECT
    'Eventlist Dev 北京演唱会',
    'concert',
    'large',
    '110105',
    '北京展演中心',
    '北京市朝阳区测试路 1 号',
    '2026-08-02',
    '2026-08-02',
    '10:00',
    '18:00',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
    '本地开发用 published 样例，用于验证首页、列表、详情与 sitemap。',
    '123456789',
    'https://example.com/tickets/eventlist-dev-beijing',
    'https://example.com/eventlist/dev-beijing-concert',
    'dev@example.com',
    'published',
    datetime('now')
WHERE NOT EXISTS (
      SELECT 1 FROM events
      WHERE source_url = 'https://example.com/eventlist/dev-beijing-concert'
  );

INSERT INTO events(
    title, type, scale, division_code, venue, address,
    start_date, end_date, start_time, end_time, cover_url, description,
    qq_group, ticket_url, source_url, submitter_contact, status, published_at
)
SELECT
    'Eventlist Dev 上海同人展',
    'doujin',
    'mid',
    '310115',
    '上海同好会馆',
    '上海市浦东新区测试路 2 号',
    '2026-08-16',
    '2026-08-17',
    '09:30',
    NULL,
    NULL,
    '本地开发用 published 样例，用于验证跨城市筛选。',
    NULL,
    NULL,
    'https://example.com/eventlist/dev-shanghai-doujin',
    'dev@example.com',
    'published',
    datetime('now')
WHERE NOT EXISTS (
      SELECT 1 FROM events
      WHERE source_url = 'https://example.com/eventlist/dev-shanghai-doujin'
  );

WITH shanghai_samples(
    title, type, scale, division_code, venue, address,
    start_offset, end_offset, start_time, end_time, cover_url, description,
    ticket_url, source_url
) AS (
    VALUES
        (
            'Eventlist Dev 上海浦东动漫嘉年华',
            'comic', 'large', '310115', '浦东测试展览中心', '上海市浦东新区测试大道 101 号',
            '+7 days', '+8 days', '09:30', '17:30',
            'https://images.unsplash.com/photo-1608889175123-8ee362201f81',
            '上海未来活动样例 01，用于验证地区筛选、分页与大型漫展展示。',
            'https://example.com/tickets/shanghai-anime-carnival',
            'https://example.com/eventlist/dev-shanghai-anime-carnival'
        ),
        (
            'Eventlist Dev 上海徐汇虚拟歌手音乐会',
            'concert', 'mid', '310104', '徐汇测试音乐厅', '上海市徐汇区测试路 102 号',
            '+10 days', '+10 days', '18:30', '21:00',
            'https://images.unsplash.com/photo-1501386761578-eac5c94b800a',
            '上海未来活动样例 02，用于验证单日音乐活动和购票链接。',
            'https://example.com/tickets/shanghai-virtual-singer-live',
            'https://example.com/eventlist/dev-shanghai-virtual-singer-live'
        ),
        (
            'Eventlist Dev 上海黄浦东方同人交流会',
            'doujin', 'mid', '310101', '黄浦测试文化馆', '上海市黄浦区测试路 103 号',
            '+14 days', '+14 days', '10:00', '16:30',
            NULL,
            '上海未来活动样例 03，用于验证同人展与作品标签组合。',
            NULL,
            'https://example.com/eventlist/dev-shanghai-touhou-meetup'
        ),
        (
            'Eventlist Dev 上海静安二点五次元舞台剧',
            'stage', 'mid', '310106', '静安测试剧场', '上海市静安区测试路 104 号',
            '+17 days', '+18 days', '19:00', '21:30',
            'https://images.unsplash.com/photo-1503095396549-807759245b35',
            '上海未来活动样例 04，用于验证跨日舞台活动。',
            'https://example.com/tickets/shanghai-2-5d-stage',
            'https://example.com/eventlist/dev-shanghai-2-5d-stage'
        ),
        (
            'Eventlist Dev 上海闵行宅舞公演',
            'dance', 'small', '310112', '闵行测试艺术空间', '上海市闵行区测试路 105 号',
            '+21 days', '+21 days', '14:00', '18:00',
            NULL,
            '上海未来活动样例 05，用于验证小型宅舞活动。',
            NULL,
            'https://example.com/eventlist/dev-shanghai-otaku-dance'
        ),
        (
            'Eventlist Dev 上海长宁IP主题快闪',
            'ipflash', 'small', '310105', '长宁测试商业广场', '上海市长宁区测试路 106 号',
            '+24 days', '+31 days', NULL, NULL,
            'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a',
            '上海未来活动样例 06，用于验证无具体时间的多日快闪活动。',
            NULL,
            'https://example.com/eventlist/dev-shanghai-ip-pop-up'
        ),
        (
            'Eventlist Dev 上海杨浦游戏文化节',
            'comic', 'large', '310110', '杨浦测试会展中心', '上海市杨浦区测试路 107 号',
            '+28 days', '+29 days', '09:00', '18:00',
            'https://images.unsplash.com/photo-1511512578047-dfb367046420',
            '上海未来活动样例 07，用于验证游戏与漫展标签筛选。',
            'https://example.com/tickets/shanghai-game-festival',
            'https://example.com/eventlist/dev-shanghai-game-festival'
        ),
        (
            'Eventlist Dev 上海虹口声优见面会',
            'stage', 'small', '310109', '虹口测试演艺厅', '上海市虹口区测试路 108 号',
            '+32 days', '+32 days', '13:30', '16:00',
            NULL,
            '上海未来活动样例 08，用于验证小型舞台演出。',
            'https://example.com/tickets/shanghai-voice-actor-meetup',
            'https://example.com/eventlist/dev-shanghai-voice-actor-meetup'
        ),
        (
            'Eventlist Dev 上海普陀同人创作市集',
            'doujin', 'mid', '310107', '普陀测试创意园', '上海市普陀区测试路 109 号',
            '+35 days', '+35 days', '10:30', '17:00',
            NULL,
            '上海未来活动样例 09，用于验证同人市集和区县筛选。',
            NULL,
            'https://example.com/eventlist/dev-shanghai-creator-market'
        ),
        (
            'Eventlist Dev 上海宝山动漫音乐节',
            'concert', 'large', '310113', '宝山测试音乐公园', '上海市宝山区测试路 110 号',
            '+38 days', '+39 days', '11:00', '21:00',
            'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
            '上海未来活动样例 10，用于验证多日大型音乐活动。',
            'https://example.com/tickets/shanghai-anime-music-festival',
            'https://example.com/eventlist/dev-shanghai-anime-music-festival'
        ),
        (
            'Eventlist Dev 上海嘉定线上线下联动展',
            'online', 'mid', '310114', '嘉定测试数字中心', '上海市嘉定区测试路 111 号',
            '+42 days', '+42 days', '10:00', '20:00',
            NULL,
            '上海未来活动样例 11，用于验证线上类型与线下地点共存。',
            NULL,
            'https://example.com/eventlist/dev-shanghai-hybrid-expo'
        ),
        (
            'Eventlist Dev 上海松江ACG综合展',
            'comic', 'mega', '310117', '松江测试国际会展中心', '上海市松江区测试路 112 号',
            '+49 days', '+50 days', '09:00', '18:30',
            'https://images.unsplash.com/photo-1540575467063-178a50c2df87',
            '上海未来活动样例 12，用于验证超大型活动、分页和热门列表。',
            'https://example.com/tickets/shanghai-acg-expo',
            'https://example.com/eventlist/dev-shanghai-acg-expo'
        )
)
INSERT INTO events(
    title, type, scale, division_code, venue, address,
    start_date, end_date, start_time, end_time, cover_url, description,
    qq_group, ticket_url, source_url, submitter_contact, status, published_at
)
SELECT
    title,
    type,
    scale,
    division_code,
    venue,
    address,
    date('now', '+8 hours', start_offset),
    date('now', '+8 hours', end_offset),
    start_time,
    end_time,
    cover_url,
    description,
    NULL,
    ticket_url,
    source_url,
    'dev@example.com',
    'published',
    datetime('now')
FROM shanghai_samples
WHERE NOT EXISTS (
    SELECT 1 FROM events WHERE events.source_url = shanghai_samples.source_url
);

INSERT INTO events(
    title, type, scale, division_code, venue, address,
    start_date, end_date, start_time, end_time, cover_url, description,
    qq_group, ticket_url, source_url, submitter_contact, status, published_at
)
SELECT
    'Eventlist Dev 已结束同人展',
    'doujin',
    'mid',
    '320102',
    '南京同好会馆',
    '南京市玄武区测试路 5 号',
    date('now', '+8 hours', '-15 days'),
    date('now', '+8 hours', '-14 days'),
    '09:30',
    '17:00',
    NULL,
    '本地开发用已结束 published 样例，可通过活动页的“已结束”状态筛选检索。',
    NULL,
    NULL,
    'https://example.com/eventlist/dev-ended-doujin',
    'dev@example.com',
    'published',
    datetime('now')
WHERE NOT EXISTS (
      SELECT 1 FROM events
      WHERE source_url = 'https://example.com/eventlist/dev-ended-doujin'
  );

INSERT INTO events(
    title, type, scale, division_code, venue, address,
    start_date, end_date, cover_url, description,
    qq_group, ticket_url, source_url, submitter_contact, status, published_at
)
SELECT
    'Eventlist Dev 已下线舞台剧',
    'stage',
    'small',
    '440106',
    '广州剧场',
    '广州市天河区测试路 3 号',
    '2026-07-20',
    '2026-07-20',
    NULL,
    '本地开发用 offline 样例，详情页可见但列表不展示。',
    NULL,
    NULL,
    'https://example.com/eventlist/dev-offline-stage',
    'dev@example.com',
    'offline',
    datetime('now')
WHERE NOT EXISTS (
      SELECT 1 FROM events
      WHERE source_url = 'https://example.com/eventlist/dev-offline-stage'
  );

INSERT INTO events(
    title, type, scale, division_code, venue, address,
    start_date, end_date, cover_url, description,
    qq_group, ticket_url, source_url, submitter_contact, status
)
SELECT
    'Eventlist Dev 待审核活动',
    'comic',
    'small',
    '510104',
    '成都测试展馆',
    '成都市测试路 4 号',
    '2026-09-01',
    '2026-09-01',
    NULL,
    '本地开发用 pending 样例，公共详情应返回 404。',
    NULL,
    NULL,
    'https://example.com/eventlist/dev-pending-comic',
    'dev@example.com',
    'pending'
WHERE NOT EXISTS (
      SELECT 1 FROM events
      WHERE source_url = 'https://example.com/eventlist/dev-pending-comic'
  );

INSERT INTO event_tags(event_id, tag_id)
SELECT events.id, tags.id
FROM events
JOIN tags ON tags.name IN ('初音未来', '购票开放')
WHERE events.source_url = 'https://example.com/eventlist/dev-beijing-concert'
ON CONFLICT(event_id, tag_id) DO NOTHING;

INSERT INTO event_tags(event_id, tag_id)
SELECT events.id, tags.id
FROM events
JOIN tags ON tags.name = '同人展'
WHERE events.source_url = 'https://example.com/eventlist/dev-shanghai-doujin'
ON CONFLICT(event_id, tag_id) DO NOTHING;

WITH shanghai_tag_links(source_url, tag_name) AS (
    VALUES
        ('https://example.com/eventlist/dev-shanghai-anime-carnival', '漫展'),
        ('https://example.com/eventlist/dev-shanghai-anime-carnival', '购票开放'),
        ('https://example.com/eventlist/dev-shanghai-virtual-singer-live', '初音未来'),
        ('https://example.com/eventlist/dev-shanghai-virtual-singer-live', '音乐现场'),
        ('https://example.com/eventlist/dev-shanghai-touhou-meetup', '东方Project'),
        ('https://example.com/eventlist/dev-shanghai-touhou-meetup', '同人展'),
        ('https://example.com/eventlist/dev-shanghai-2-5d-stage', '舞台剧'),
        ('https://example.com/eventlist/dev-shanghai-2-5d-stage', '舞台演出'),
        ('https://example.com/eventlist/dev-shanghai-otaku-dance', '舞台演出'),
        ('https://example.com/eventlist/dev-shanghai-ip-pop-up', 'IP快闪'),
        ('https://example.com/eventlist/dev-shanghai-game-festival', '游戏'),
        ('https://example.com/eventlist/dev-shanghai-game-festival', '漫展'),
        ('https://example.com/eventlist/dev-shanghai-voice-actor-meetup', '舞台演出'),
        ('https://example.com/eventlist/dev-shanghai-creator-market', '同人展'),
        ('https://example.com/eventlist/dev-shanghai-anime-music-festival', '音乐现场'),
        ('https://example.com/eventlist/dev-shanghai-anime-music-festival', '漫展'),
        ('https://example.com/eventlist/dev-shanghai-hybrid-expo', '游戏'),
        ('https://example.com/eventlist/dev-shanghai-acg-expo', '漫展'),
        ('https://example.com/eventlist/dev-shanghai-acg-expo', '购票开放')
)
INSERT INTO event_tags(event_id, tag_id)
SELECT events.id, tags.id
FROM shanghai_tag_links
JOIN events ON events.source_url = shanghai_tag_links.source_url
JOIN tags ON tags.name = shanghai_tag_links.tag_name
ON CONFLICT(event_id, tag_id) DO NOTHING;

INSERT INTO event_tags(event_id, tag_id)
SELECT events.id, tags.id
FROM events
JOIN tags ON tags.name = '同人展'
WHERE events.source_url = 'https://example.com/eventlist/dev-ended-doujin'
ON CONFLICT(event_id, tag_id) DO NOTHING;

INSERT INTO event_tags(event_id, tag_id)
SELECT events.id, tags.id
FROM events
JOIN tags ON tags.name = '舞台剧'
WHERE events.source_url = 'https://example.com/eventlist/dev-offline-stage'
ON CONFLICT(event_id, tag_id) DO NOTHING;
