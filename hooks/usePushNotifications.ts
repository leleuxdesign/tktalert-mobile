import { useState, useEffect, useRef } from "react";
import { Platform, Alert } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) setExpoPushToken(token);
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener((n) => {
        setNotification(n);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        // Handle notification tap — navigate to alert history
        console.log("[Push] Notification tapped:", response);
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push notifications don't work in simulator — skip silently
    return null;
  }

  // Request permission
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    Alert.alert(
      "Notifications Disabled",
      "Enable notifications in Settings to receive parking alerts.",
      [{ text: "OK" }]
    );
    return null;
  }

  // Get the Expo push token
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn("[Push] No EAS project ID found — push token unavailable");
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

  // Android requires a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("parking-alerts", {
      name: "Parking Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22c55e",
      sound: "default",
    });
  }

  return tokenData.data;
}
