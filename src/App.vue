<script setup>
import HelloWorld from '@/components/HelloWorld.vue'
import TheWelcome from '@/components/TheWelcome.vue'
import CesiumTest from '@/components/cesiumTest/index.vue'
import MCPtest from '@/components/MCPtest/index.vue'

import { ref, computed } from 'vue'
const routes = {
    '/HelloWorld': HelloWorld,
    '/TheWelcome': TheWelcome,
    '/CesiumTest': CesiumTest,
    '/MCPtest': MCPtest,
}
const currentPath = ref(window.location.hash)
window.addEventListener('hashchange', () => {
    currentPath.value = window.location.hash
})
const currentView = computed(() => {
    return routes[currentPath.value.slice(1) || '/']
})

</script>


<template>
  <div style="width:100%;height: 100%;border: 1px solid black">
      <div v-for="[item,index] of Object.entries(routes)">
          <a :href="'#'+item">{{ item.split("/")[1] }}</a> |
      </div>

      <component style="width: 500px;height: 500px;overflow:auto;border:10px solid #ffcaca" :is="currentView" />
  </div>
</template>

<style scoped>


</style>
