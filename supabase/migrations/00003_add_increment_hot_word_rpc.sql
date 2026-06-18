
CREATE OR REPLACE FUNCTION increment_hot_word(kw text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO search_hot_words (keyword, search_count, updated_at)
  VALUES (kw, 1, now())
  ON CONFLICT (keyword)
  DO UPDATE SET search_count = search_hot_words.search_count + 1,
                updated_at   = now();
END;
$$;
