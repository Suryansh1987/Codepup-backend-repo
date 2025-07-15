-- Create admin user in auth.users table
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@bridalbeauty.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Create admin profile
INSERT INTO profiles (id, email, role, full_name) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin@bridalbeauty.com', 'admin', 'Admin User')
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Insert sample services
INSERT INTO services (id, name, description, price, duration, image_url, is_featured, category) VALUES 
  ('00000000-0000-0000-0000-000000000010', 'Bridal Makeup Complete', 'Full bridal makeup including trial session, complete look for wedding day with touch-ups', 450.00, '4 hours', '/api/placeholder/400/300', true, 'Bridal'),
  ('00000000-0000-0000-0000-000000000011', 'Engagement Party Makeup', 'Elegant makeup for engagement celebrations with long-lasting finish', 180.00, '2 hours', '/api/placeholder/400/300', true, 'Special Events'),
  ('00000000-0000-0000-0000-000000000012', 'Bridal Trial Session', 'Pre-wedding makeup trial to perfect your bridal look', 120.00, '1.5 hours', '/api/placeholder/400/300', true, 'Bridal'),
  ('00000000-0000-0000-0000-000000000013', 'Bridesmaids Makeup', 'Beautiful makeup for bridesmaids to complement the bride', 85.00, '1 hour', '/api/placeholder/400/300', false, 'Bridal Party'),
  ('00000000-0000-0000-0000-000000000014', 'Mother of Bride Makeup', 'Elegant and sophisticated makeup for mothers of the bride/groom', 95.00, '1.5 hours', '/api/placeholder/400/300', false, 'Family'),
  ('00000000-0000-0000-0000-000000000015', 'Mehndi Ceremony Makeup', 'Traditional and vibrant makeup for mehndi celebrations', 150.00, '2 hours', '/api/placeholder/400/300', true, 'Cultural Events'),
  ('00000000-0000-0000-0000-000000000016', 'Reception Makeup', 'Glamorous evening makeup for wedding reception', 200.00, '2 hours', '/api/placeholder/400/300', true, 'Bridal'),
  ('00000000-0000-0000-0000-000000000017', 'Bridal Hair Styling', 'Professional hair styling to complement your bridal makeup', 160.00, '2 hours', '/api/placeholder/400/300', false, 'Hair & Makeup'),
  ('00000000-0000-0000-0000-000000000018', 'Pre-Wedding Photoshoot', 'Makeup and styling for pre-wedding photography sessions', 250.00, '3 hours', '/api/placeholder/400/300', true, 'Photography'),
  ('00000000-0000-0000-0000-000000000019', 'Destination Wedding Package', 'Complete bridal beauty package for destination weddings', 650.00, '6 hours', '/api/placeholder/400/300', true, 'Packages')
ON CONFLICT (id) DO NOTHING;

-- Insert sample testimonials
INSERT INTO testimonials (id, name, review, rating, image_url) VALUES 
  ('00000000-0000-0000-0000-000000000020', 'Sarah Johnson', 'Absolutely amazing experience! The makeup artist made me feel like a princess on my wedding day. The attention to detail was incredible and the makeup lasted all day and night.', 5, '/api/placeholder/100/100'),
  ('00000000-0000-0000-0000-000000000021', 'Emily Rodriguez', 'I was so nervous about my wedding makeup, but the trial session put me at ease. The final look was exactly what I dreamed of - elegant and timeless.', 5, '/api/placeholder/100/100'),
  ('00000000-0000-0000-0000-000000000022', 'Priya Patel', 'The mehndi ceremony makeup was perfect! The artist understood exactly what I wanted and created a beautiful traditional look that photographed beautifully.', 5, '/api/placeholder/100/100'),
  ('00000000-0000-0000-0000-000000000023', 'Jessica Chen', 'Professional, punctual, and talented! My bridesmaids and I all looked stunning. The makeup lasted through tears of joy and hours of dancing.', 5, '/api/placeholder/100/100'),
  ('00000000-0000-0000-0000-000000000024', 'Amanda Williams', 'The destination wedding package was worth every penny. Having the makeup artist travel with us made the day so much smoother and stress-free.', 5, '/api/placeholder/100/100'),
  ('00000000-0000-0000-0000-000000000025', 'Rachel Thompson', 'My engagement party makeup was flawless! I received so many compliments and felt confident throughout the entire celebration.', 5, '/api/placeholder/100/100')
ON CONFLICT (id) DO NOTHING;

-- Insert sample portfolio items
INSERT INTO portfolio (id, title, description, image_url, category) VALUES 
  ('00000000-0000-0000-0000-000000000030', 'Classic Bridal Elegance', 'Timeless bridal makeup with soft glam and natural glow', '/api/placeholder/300/400', 'Bridal'),
  ('00000000-0000-0000-0000-000000000031', 'Indian Wedding Glam', 'Traditional Indian bridal makeup with bold eyes and rich colors', '/api/placeholder/300/400', 'Cultural'),
  ('00000000-0000-0000-0000-000000000032', 'Modern Minimalist Bride', 'Clean, modern bridal look with subtle enhancement', '/api/placeholder/300/400', 'Bridal'),
  ('00000000-0000-0000-0000-000000000033', 'Glamorous Evening Look', 'Dramatic evening makeup for reception celebrations', '/api/placeholder/300/400', 'Evening'),
  ('00000000-0000-0000-0000-000000000034', 'Bohemian Bride', 'Free-spirited bridal makeup with earthy tones and natural beauty', '/api/placeholder/300/400', 'Bridal'),
  ('00000000-0000-0000-0000-000000000035', 'Vintage Hollywood Glam', 'Old Hollywood inspired bridal makeup with winged liner and red lips', '/api/placeholder/300/400', 'Vintage'),
  ('00000000-0000-0000-0000-000000000036', 'Destination Beach Bride', 'Fresh, dewy makeup perfect for beach weddings', '/api/placeholder/300/400', 'Destination'),
  ('00000000-0000-0000-0000-000000000037', 'Bridesmaids Perfection', 'Coordinated makeup looks for the bridal party', '/api/placeholder/300/400', 'Bridal Party')
ON CONFLICT (id) DO NOTHING;

-- Insert sample user profiles
INSERT INTO profiles (id, email, full_name, role, phone, wedding_date, notes) VALUES 
  ('00000000-0000-0000-0000-000000000040', 'sarah.johnson@email.com', 'Sarah Johnson', 'user', '+1-555-0101', '2024-06-15', 'Prefers natural look with subtle enhancement'),
  ('00000000-0000-0000-0000-000000000041', 'emily.rodriguez@email.com', 'Emily Rodriguez', 'user', '+1-555-0102', '2024-08-20', 'Loves bold eye makeup, classic style'),
  ('00000000-0000-0000-0000-000000000042', 'priya.patel@email.com', 'Priya Patel', 'user', '+1-555-0103', '2024-09-10', 'Traditional Indian wedding, rich colors preferred'),
  ('00000000-0000-0000-0000-000000000043', 'jessica.chen@email.com', 'Jessica Chen', 'user', '+1-555-0104', '2024-07-25', 'Minimalist approach, wants to look like herself'),
  ('00000000-0000-0000-0000-000000000044', 'amanda.williams@email.com', 'Amanda Williams', 'user', '+1-555-0105', '2024-12-01', 'Destination wedding in Hawaii, natural beach look')
ON CONFLICT (id) DO NOTHING;

-- Insert sample bookings
INSERT INTO bookings (id, user_id, service_id, booking_date, booking_time, status, total_amount) VALUES 
  ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000010', '2024-06-14', '08:00:00', 'confirmed', 450.00),
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000012', '2024-07-15', '14:00:00', 'confirmed', 120.00),
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000015', '2024-08-18', '10:00:00', 'pending', 150.00),
  ('00000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000011', '2024-05-20', '16:00:00', 'confirmed', 180.00),
  ('00000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000019', '2024-11-28', '09:00:00', 'pending', 650.00)
ON CONFLICT (id) DO NOTHING;