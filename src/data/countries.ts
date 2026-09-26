/**
 * Autocomplete hints for the country inputs. Deliberately a `<datalist>` source
 * and not an enum: genealogy regularly involves places that no longer exist as
 * countries, so the inputs accept any free text and these only speed up typing.
 */
export const COUNTRY_HINTS = [
  'India', 'Pakistan', 'Bangladesh', 'Nepal', 'Sri Lanka',
  'United Kingdom', 'United States', 'Canada', 'Australia', 'New Zealand',
  'South Africa', 'Kenya', 'Nigeria', 'Ghana', 'Egypt',
  'Germany', 'France', 'Italy', 'Spain', 'Portugal', 'Netherlands', 'Poland',
  'Ireland', 'Greece', 'Turkey', 'Russia', 'Ukraine',
  'China', 'Japan', 'South Korea', 'Vietnam', 'Thailand', 'Philippines',
  'Indonesia', 'Malaysia', 'Singapore',
  'Brazil', 'Mexico', 'Argentina', 'Colombia', 'Peru',
  'United Arab Emirates', 'Saudi Arabia', 'Israel', 'Iran', 'Iraq',
];
