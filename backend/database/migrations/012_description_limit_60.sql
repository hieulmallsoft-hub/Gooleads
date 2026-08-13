UPDATE creative_policies
SET description_max_length = 60,
    updated_at = NOW()
WHERE description_max_length > 60;
