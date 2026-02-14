Pod::Spec.new do |s|
  s.name           = 'ExpoAppleMusic'
  s.version        = '1.0.0'
  s.summary        = 'Native Apple Music integration for Expo'
  s.description    = 'Provides native MusicKit functionality for React Native/Expo apps'
  s.author         = ''
  s.homepage       = 'https://github.com'
  s.platform       = :ios, '15.0'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
end
