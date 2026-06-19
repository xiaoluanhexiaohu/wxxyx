<script setup lang="ts">
import { onLaunch, onShow } from "@dcloudio/uni-app";
import { writeStorage, storageKeys } from "@/services/storage";

onLaunch((options) => {
  saveInviteBy(options?.query?.inviteBy);
  // Keep app startup light. Page-level stores and ads are initialized only when the user reaches them.
});

onShow((options) => {
  saveInviteBy(options?.query?.inviteBy);
});

function saveInviteBy(inviteBy?: string) {
  if (!inviteBy) return;
  writeStorage(storageKeys.pendingInviteBy, inviteBy);
}
</script>

<style>
page {
  min-height: 100%;
  background: #121212;
  color: #f4f7f7;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
}

view,
text,
button,
input {
  box-sizing: border-box;
}

button {
  margin: 0;
  padding: 0;
  border-radius: 8px;
  line-height: 1;
}

button::after {
  border: 0;
}
</style>
