alter table public.reports drop constraint if exists reports_category_check;
alter table public.reports add constraint reports_category_check check (
  category in ('Broken light','Unsafe path','Harassment concern','Hazard')
  or (category like 'Other: %' and char_length(category) between 9 and 67 and category !~ '[<>&"''`]')
);