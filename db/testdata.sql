-- Add test users
INSERT INTO users (name, contact_method, contact_info) VALUES
('Robi Santos', 'messenger', 'facebook.com/robi'),
('RV Cruz', 'viber', '0917-123-4567'),
('Brenda Pelagio', 'phone', '0918-234-5678'),
('Karren Lopez', 'messenger', 'facebook.com/karren');

-- Add test ride posts
INSERT INTO ride_posts (user_id, post_type, origin_id, destination_id, days_of_week, departure_time, notes) VALUES
(1, 'request', 2, 1, ARRAY['wednesday'], '06:00:00', 'Looking for carpool to Dau or Cubao. Wednesday early morning.'),
(2, 'request', 2, 1, ARRAY['monday', 'tuesday', 'thursday'], '19:30:00', 'From Dau to Phirst, 7:30pm'),
(3, 'request', 5, 6, ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], '07:00:00', 'Daily carpool from Cheerful Homes to AUF'),
(4, 'offer', 1, 4, ARRAY['tuesday'], '18:00:00', 'Carpool to Manila, Tuesday PM');

-- Check it worked
SELECT * FROM active_rides;