require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

# The name is not a matter of taste: Capacitor derives the pod it asks for from the package
# name (`nostrride-heartbeat` → `NostrrideHeartbeat`) and CocoaPods looks for a podspec of
# that name in this folder. Rename one without the other and `pod install` fails.
Pod::Spec.new do |s|
  s.name = 'NostrrideHeartbeat'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = package['homepage']
  s.author = 'NostrRide'
  s.source = { :git => package['homepage'], :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '13.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
