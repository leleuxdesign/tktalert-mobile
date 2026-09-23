import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { logAction } from "@/lib/analytics";
import { colors, fontFamily } from "@/lib/ios6-theme";
import { IosPage, IosNavBar, IosButton } from "@/components/ios6";

/**
 * One-to-one conversation with the Owner.
 *
 * Not a ticket queue — with a single operator, the useful model is a running
 * conversation that never closes, so a customer who wrote in three months ago
 * still sees that history rather than starting from nothing.
 */
export default function SupportScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const utils = trpc.useUtils();

  const { data, refetch } = trpc.support.myThread.useQuery(undefined, {
    refetchInterval: 20_000,
  });
  // Log the open here (not at the caller) so every entry point is covered. No
  // content is ever logged — just that support was opened / a message was sent.
  useEffect(() => {
    logAction("support_opened");
  }, []);

  const markRead = trpc.support.markRead.useMutation();
  const send = trpc.support.send.useMutation({
    onSuccess: async () => {
      logAction("message_sent");
      setDraft("");
      await utils.support.myThread.invalidate();
      refetch();
    },
    // A failed send used to do nothing visible, which reads as "sent".
    onError: (err: any) =>
      Alert.alert("Message not sent", err?.message || "Please check your connection and try again."),
  });

  // Clear the badge once they are actually looking at the thread.
  useEffect(() => {
    if ((data as any)?.unread > 0) markRead.mutate();
  }, [(data as any)?.unread]);

  const messages: any[] = (data as any)?.messages ?? [];

  return (
    <IosPage>
      <IosNavBar title="Support" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Talk to us directly</Text>
              <Text style={styles.emptyBody}>
                Questions, problems, or ideas for what TattleTow should do next — this
                goes straight to the person who builds it, not a support queue.
              </Text>
            </View>
          ) : (
            messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.bubble,
                  m.senderRole === "user" ? styles.mine : styles.theirs,
                ]}
              >
                <Text style={m.senderRole === "user" ? styles.mineText : styles.theirsText}>
                  {m.body}
                </Text>
                <Text style={[styles.stamp, m.senderRole === "user" && { color: "rgba(255,255,255,0.75)" }]}>
                  {new Date(m.createdAt).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Write a message…"
            placeholderTextColor={colors.textLight}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <IosButton
            variant="blue"
            loading={send.isPending}
            onPress={() => {
              if (draft.trim()) send.mutate({ body: draft.trim() });
            }}
          >
            Send
          </IosButton>
        </View>
      </KeyboardAvoidingView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 28, paddingHorizontal: 8, alignItems: "center", gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text, fontFamily },
  emptyBody: { fontSize: 13, color: colors.textLight, fontFamily, textAlign: "center", lineHeight: 19 },
  bubble: { maxWidth: "82%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.blue },
  theirs: { alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.06)" },
  mineText: { color: "#fff", fontSize: 15, fontFamily, lineHeight: 20 },
  theirsText: { color: colors.text, fontSize: 15, fontFamily, lineHeight: 20 },
  stamp: { fontSize: 10, color: colors.textLight, fontFamily, marginTop: 4 },
  composer: {
    padding: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.12)", backgroundColor: colors.background,
  },
  input: {
    minHeight: 44, maxHeight: 120, borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.18)", borderRadius: 10, backgroundColor: "#fff",
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: colors.text, fontFamily,
  },
});
