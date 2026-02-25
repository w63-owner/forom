-- Enforce minimum and maximum length on proposition titles
-- Prevents empty titles and DoS via extremely long inputs
ALTER TABLE propositions
  ADD CONSTRAINT propositions_title_not_empty
    CHECK (char_length(trim(title)) >= 1);

ALTER TABLE propositions
  ADD CONSTRAINT propositions_title_max_length
    CHECK (char_length(title) <= 500);

-- Enforce minimum and maximum length on page names
ALTER TABLE pages
  ADD CONSTRAINT pages_name_not_empty
    CHECK (char_length(trim(name)) >= 1);

ALTER TABLE pages
  ADD CONSTRAINT pages_name_max_length
    CHECK (char_length(name) <= 255);
