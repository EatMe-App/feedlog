<script setup lang="ts">
usePageOg({ kind: 'roadmap' })

const postDetailStore = usePostDetailStore()
const showDetail = ref(false)
const detailSlug = ref<string | null>(null)
const kanbanRef = ref<{ updateItem: (post: any) => void; removeItem: (id: string) => void } | null>(null)

function openPostDetail(item: PostListItem) {
  postDetailStore.prefill(item.slug, item)
  detailSlug.value = item.slug
  showDetail.value = true
}
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0 max-h-[calc(100vh-5rem)] min-h-[500px]">
    <!-- Title area -->
    <div class="pb-3 md:pb-6">
      <div class="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3">
        <h1 class="font-heading text-xl sm:text-2xl font-bold tracking-tight shrink-0">{{ $t('roadmap.title') }}</h1>
        <p class="text-xs sm:text-sm text-muted-foreground leading-relaxed">{{ $t('roadmap.subtitle') }}</p>
      </div>
    </div>

    <!-- Board area -->
    <div class="flex-1 overflow-y-auto md:overflow-x-auto md:overflow-y-hidden min-h-[400px]">
      <RoadmapKanban ref="kanbanRef" @open-detail="openPostDetail" />
    </div>
  </div>

  <PostDetailModal
    v-model:open="showDetail"
    :slug="detailSlug"
    @updated="kanbanRef?.updateItem($event)"
    @deleted="kanbanRef?.removeItem($event)"
  />
</template>
