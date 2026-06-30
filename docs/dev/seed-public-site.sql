PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO tags(name) VALUES
    ('初音未来'),
    ('同人展'),
    ('舞台剧'),
    ('购票开放');

INSERT INTO events(
    title, type, scale, city_id, venue, address,
    start_date, end_date, cover_url, description,
    qq_group, ticket_url, source_url, submitter_contact, status, published_at
)
SELECT
    'Eventlist Dev 北京演唱会',
    'concert',
    'large',
    cities.id,
    '北京展演中心',
    '北京市朝阳区测试路 1 号',
    '2026-08-02',
    '2026-08-02',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
    '本地开发用 published 样例，用于验证首页、列表、详情与 sitemap。',
    '123456789',
    'https://example.com/tickets/eventlist-dev-beijing',
    'https://example.com/eventlist/dev-beijing-concert',
    'dev@example.com',
    'published',
    datetime('now')
FROM cities
WHERE cities.name = '北京'
  AND NOT EXISTS (
      SELECT 1 FROM events
      WHERE source_url = 'https://example.com/eventlist/dev-beijing-concert'
  );

INSERT INTO events(
    title, type, scale, city_id, venue, address,
    start_date, end_date, cover_url, description,
    qq_group, ticket_url, source_url, submitter_contact, status, published_at
)
SELECT
    'Eventlist Dev 上海同人展',
    'doujin',
    'mid',
    cities.id,
    '上海同好会馆',
    '上海市浦东新区测试路 2 号',
    '2026-08-16',
    '2026-08-17',
    NULL,
    '本地开发用 published 样例，用于验证跨城市筛选。',
    NULL,
    NULL,
    'https://example.com/eventlist/dev-shanghai-doujin',
    'dev@example.com',
    'published',
    datetime('now')
FROM cities
WHERE cities.name = '上海'
  AND NOT EXISTS (
      SELECT 1 FROM events
      WHERE source_url = 'https://example.com/eventlist/dev-shanghai-doujin'
  );

INSERT INTO events(
    title, type, scale, city_id, venue, address,
    start_date, end_date, cover_url, description,
    qq_group, ticket_url, source_url, submitter_contact, status, published_at
)
SELECT
    'Eventlist Dev 已下线舞台剧',
    'stage',
    'small',
    cities.id,
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
FROM cities
WHERE cities.name = '广州'
  AND NOT EXISTS (
      SELECT 1 FROM events
      WHERE source_url = 'https://example.com/eventlist/dev-offline-stage'
  );

INSERT INTO events(
    title, type, scale, city_id, venue, address,
    start_date, end_date, cover_url, description,
    qq_group, ticket_url, source_url, submitter_contact, status
)
SELECT
    'Eventlist Dev 待审核活动',
    'comic',
    'small',
    cities.id,
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
FROM cities
WHERE cities.name = '成都'
  AND NOT EXISTS (
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

INSERT INTO event_tags(event_id, tag_id)
SELECT events.id, tags.id
FROM events
JOIN tags ON tags.name = '舞台剧'
WHERE events.source_url = 'https://example.com/eventlist/dev-offline-stage'
ON CONFLICT(event_id, tag_id) DO NOTHING;
