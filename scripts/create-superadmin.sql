-- Создаем суперадмина
INSERT INTO users (
  id,
  phone,
  "firstName",
  "lastName",
  email,
  "isActive",
  "isSuperAdmin",
  "createdAt",
  "updatedAt"
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  '+77071478070',
  'Super',
  'Admin',
  'admin@saudapro.kz',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE phone = '+77071478070'
);

-- Если пользователь уже существует, обновляем его права
UPDATE users 
SET "isSuperAdmin" = true,
    "isActive" = true
WHERE phone = '+77071478070';