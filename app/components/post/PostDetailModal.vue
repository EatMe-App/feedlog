<script setup lang="ts">

import type { PostUpdatedEvent } from './PostDetail.vue'
import { preventShadcnDialogClose } from '~/lib/md-editor-helper';

const props = defineProps<{
  slug?: string | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  updated: [post: PostUpdatedEvent]
  deleted: [postId: string]
}>()

const localePath = useLocalePath()
const store = usePostDetailStore()

watch(open, (isOpen) => {
  if (isOpen && props.slug) {
    store.fetchPost(props.slug)
    store.fetchComments(props.slug)
  }
}, { immediate: true })

</script>

<template>
  <!-- Keep non-modal so md-editor/medium-zoom overlays teleported to body stay interactive -->
  <Dialog v-model:open="open" :modal="true">
    <DialogContent
      :show-close-button="false"
      @open-auto-focus.prevent
      @pointer-down-outside="preventShadcnDialogClose"
      @escape-key-down="preventShadcnDialogClose"
      class="w-full max-w-full sm:max-w-[calc(100vw-1.5rem)] lg:max-w-[1100px] h-[100dvh] sm:h-[85vh] !p-0 !gap-0 overflow-hidden border-none sm:border sm:border-border bg-background rounded-none sm:rounded-2xl flex flex-col"
    >
      <!-- Modal header -->
      <div class="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-card shrink-0">
        <div class="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <AppLogo :size="32" class="shrink-0" />
          <DialogTitle class="font-heading text-base sm:text-lg font-bold tracking-tight truncate">
            {{ $t('post.detail.modalTitle') }}
          </DialogTitle>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <NuxtLink
            v-if="slug"
            :to="localePath(`/p/${slug}`)"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-primary"
            :title="$t('post.detail.openInPage')"
            @click="open = false"
          >
            <Icon name="lucide:external-link" size="18" />
          </NuxtLink>
          <DialogClose class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-primary">
            <Icon name="lucide:x" size="20" />
          </DialogClose>
        </div>
      </div>

      <!-- Modal content: scrollable -->
      <div class="overflow-y-auto flex-1">
        <div class="flex flex-col md:flex-row gap-6 md:gap-8 p-3.5 sm:p-6 lg:p-8">
          <PostDetail
            v-if="slug"
            :slug="slug"
            @updated="emit('updated', $event)"
            @source-conversation="open = false"
            @deleted="(postId) => { emit('deleted', postId); open = false }"
          />
        </div>
      </div>

      <DialogDescription class="sr-only">
        {{ $t('post.detail.modalDescription') }}
      </DialogDescription>
    </DialogContent>
  </Dialog>
</template>
