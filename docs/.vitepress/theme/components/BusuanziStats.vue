<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useData, useRoute } from 'vitepress'

const SCRIPT_ID = 'busuanzi-script'
const SCRIPT_SRC =
  'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'

const route = useRoute()
const { frontmatter, page } = useData()

const shouldShow = computed(() => {
  if (page.value.isNotFound) {
    return false
  }

  return !frontmatter.value.home && frontmatter.value.layout !== 'home'
})

let refreshTimer: ReturnType<typeof setTimeout> | undefined

function hideContainers() {
  document
    .querySelectorAll<HTMLElement>(
      '#busuanzi_container_site_pv, #busuanzi_container_site_uv, #busuanzi_container_page_pv'
    )
    .forEach((element) => {
      element.style.display = 'none'
    })
}

function loadBusuanziScript() {
  const existingScript = document.getElementById(SCRIPT_ID)
  if (existingScript) {
    existingScript.remove()
  }

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.src = SCRIPT_SRC
  document.body.appendChild(script)
}

function refreshBusuanzi() {
  if (typeof window === 'undefined' || !shouldShow.value) {
    return
  }

  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }

  hideContainers()
  refreshTimer = setTimeout(() => {
    loadBusuanziScript()
  }, 120)
}

onMounted(() => {
  refreshBusuanzi()
})

watch(
  () => route.path,
  async () => {
    await nextTick()
    refreshBusuanzi()
  }
)

watch(shouldShow, async (visible) => {
  if (!visible) {
    return
  }

  await nextTick()
  refreshBusuanzi()
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }
})
</script>

<template>
  <div v-if="shouldShow" class="busuanzi-stats" aria-label="访问量统计">
    <span id="busuanzi_container_site_pv" class="busuanzi-item">
      总访问量
      <strong id="busuanzi_value_site_pv" />
    </span>
    <span id="busuanzi_container_site_uv" class="busuanzi-item">
      总访客数
      <strong id="busuanzi_value_site_uv" />
    </span>
    <span id="busuanzi_container_page_pv" class="busuanzi-item">
      本页阅读量
      <strong id="busuanzi_value_page_pv" />
    </span>
  </div>
</template>

<style scoped>
.busuanzi-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 24px 0 8px;
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.6;
}

.busuanzi-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
}

.busuanzi-item strong {
  color: var(--vp-c-text-1);
  font-weight: 600;
}
</style>
