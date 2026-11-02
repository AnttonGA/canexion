-- migration_v16_wallet_serial.sql — Guarda el serial de la tarjeta wallet (para push).
-- Al crear la tarjeta en WalletWallet, crear-pase.js guarda aquí su serialNumber.
-- Es el requisito para poder ACTUALIZAR el pase y lanzar notificaciones push.
-- Ejecutar en Supabase → SQL Editor.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS wallet_serial TEXT;
