#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(NativeHttpModule, NSObject)

RCT_EXTERN_METHOD(getWithoutRedirect:(NSString *)url
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getWithCookies:(NSString *)url
                  cookies:(NSArray *)cookies
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
