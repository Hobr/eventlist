INSERT INTO events (id, title, province, city, venue, address, start_date, end_date, event_type, scale, qq_group, ticket_url, poster_key, price_info, description, view_count, status)
VALUES
  ('01JZ001A2B3C4D5E6F7G8H9J0K', 'Comicup 31', '上海', '上海', '国家会展中心', '青浦区崧泽大道333号', '2026-07-15', '2026-07-16', 'doujin', '全国大型', '123456789', 'https://ticket.example.com/cp31', NULL, '预售50元/现场60元', '国内最大的同人展会之一', 1520, 'approved'),
  ('01JZ002B3C4D5E6F7G8H9J0K1', 'BW2026', '上海', '上海', '上海世博展览馆', '浦东新区国展路1099号', '2026-08-20', '2026-08-22', 'doujin', '全国大型', NULL, NULL, NULL, '待定', 'Bilibili World 2026', 890, 'approved'),
  ('01JZ003C4D5E6F7G8H9J0K1L', '明日方舟音律联觉', '上海', '上海', '梅赛德斯-奔驰文化中心', '浦东新区世博大道1200号', '2026-09-10', NULL, 'concert', '全国大型', '987654321', 'https://ticket.example.com/ark', NULL, '280-1280元', '明日方舟主题演唱会', 2100, 'approved'),
  ('01JZ004D5E6F7G8H9J0K1L2', '广州萤火虫动漫展', '广东', '广州', '广州保利世贸博览馆', '海珠区新港东路1000号', '2026-07-01', '2026-07-03', 'doujin', '区域中型', '111222333', NULL, NULL, '预售45元/现场55元', '华南地区大型漫展', 650, 'approved'),
  ('01JZ005E6F7G8H9J0K1L2M', 'CP30', '上海', '上海', '上海新国际博览中心', '浦东新区龙阳路2345号', '2026-10-01', '2026-10-02', 'doujin', '全国大型', NULL, NULL, NULL, '待定', '中国最大的同人展会', 3200, 'approved');

INSERT INTO event_works (event_id, work_name) VALUES
  ('01JZ001A2B3C4D5E6F7G8H9J0K', '原神'),
  ('01JZ001A2B3C4D5E6F7G8H9J0K', '明日方舟'),
  ('01JZ001A2B3C4D5E6F7G8H9J0K', '崩坏：星穹铁道'),
  ('01JZ002B3C4D5E6F7G8H9J0K1', 'Bilibili'),
  ('01JZ003C4D5E6F7G8H9J0K1L', '明日方舟'),
  ('01JZ004D5E6F7G8H9J0K1L2', '原神'),
  ('01JZ004D5E6F7G8H9J0K1L2', '初音未来'),
  ('01JZ005E6F7G8H9J0K1L2M', '东方Project'),
  ('01JZ005E6F7G8H9J0K1L2M', 'VOCALOID');
