-- Disable daily and weekly diary email reminders for all existing users.
-- Users can re-enable them from Settings > Diary Notifications.
UPDATE notification_preferences
SET daily_email_enabled = false,
    weekly_email_enabled = false;
