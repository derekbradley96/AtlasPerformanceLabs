# Atlas Live Updates

## When to use live updates vs App Store submission

USE live updates for:
- Bug fixes that don't touch native code
- UI changes and copy updates
- New JavaScript features
- Database query fixes
- Style and layout changes

USE App Store submission for:
- New Capacitor plugins
- Info.plist changes (new permissions)
- Native Swift/Kotlin code changes
- Entitlements changes

## Deployment

Run: `npm run deploy:live`

This builds and pushes to the production channel.
All users receive the update on their next app open.

## Testing

Test the update by deploying to a `staging` channel
first and testing on a device configured to that channel.

Run `npx cap sync` after all plugin installations.
Verify the build still compiles correctly:
`npm run build && npx cap copy ios && npx cap copy android`
