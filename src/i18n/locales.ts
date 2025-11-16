export const localeNames: Record<string, string> = {
  'ar': 'العربية', // Arabic
  'bn': 'বাংলা', // Bengali
  'ca': 'Català', // Catalan
  'cs': 'Čeština', // Czech
  'da': 'Dansk', // Danish
  'de': 'Deutsch', // German
  'el': 'Ελληνικά', // Greek
  'en': 'English', // English
  'es': 'Español', // Spanish
  'et': 'Eesti', // Estonian
  'eu': 'Euskara', // Basque
  'fi': 'Suomi', // Finnish
  'fr': 'Français', // French
  'gl': 'Galego', // Galician
  'ha': 'Hausa', // Hausa
  'he': 'עברית', // Hebrew
  'hi': 'हिन्दी', // Hindi
  'hu': 'Magyar', // Hungarian
  'it': 'Italiano', // Italian
  'ja': '日本語', // Japanese
  'ko': '한국어', // Korean
  'ms': 'Bahasa Melayu', // Malay
  'nl': 'Nederlands', // Dutch
  'pa': 'ਪੰਜਾਬੀ', // Punjabi
  'pl': 'Polski', // Polish
  'pt': 'Português', // Portuguese
  'ro': 'Română', // Romanian
  'ru': 'Русский', // Russian
  'sv': 'Svenska', // Swedish
  'sw': 'Kiswahili', // Swahili
  'tr': 'Türkçe', // Turkish
  'yo': 'Yorùbá', // Yoruba
  'zh': '中文', // Chinese
}

// RTL languages
const rtlLanguages = ['ar', 'he']

export const locales = Object.keys(localeNames).map((code) => ({
  code,
  label: localeNames[code],
  ...(rtlLanguages.includes(code) && { rtl: true }),
}))

