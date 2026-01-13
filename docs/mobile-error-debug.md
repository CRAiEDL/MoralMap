# Debugging the Expo Router "Element type is invalid" error

The screenshot error (`Element type is invalid: expected a string (for built-in components) or a class/function but got: undefined`) occurs when the JSX being rendered references a component that resolves to `undefined`. In the captured stack trace, `HomeScreen` renders `<MapView>` from `app/(tabs)/index.tsx`, so `MapView` being undefined causes the render to fail.

## Root cause
`MapView` from `react-native-maps` is a **default export**, but the component was imported with named syntax (`import { MapView } from "react-native-maps"`). Because there is no named export called `MapView`, the import resolves to `undefined`, and React surfaces the invalid element type error when the component is rendered.

## Fix
Import the component as a default export instead of a named one:

```tsx
// Before
import { MapView } from "react-native-maps";

// After
import MapView from "react-native-maps";
```

If you also use `Marker` or other helpers, keep them as named imports alongside the default:

```tsx
import MapView, { Marker } from "react-native-maps";
```

After correcting the import, the `HomeScreen` render will receive a valid component instance and the app will load without the invalid element error.
