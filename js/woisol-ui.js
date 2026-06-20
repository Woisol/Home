(() => {
  const focusableSelector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ')

  const state = {
    tooltip: null,
    modal: null,
    activeAnchor: null,
    lastFocused: null,
    scrollBound: false,
    progressBound: false,
    globalKeydownBound: false,
    modalTimer: null,
    revealObserver: null,
    revealItems: [],
    revealReady: false,
    revealEventBound: false,
    pjaxTransitionBound: false
  }

  const getWhitelist = () => (window.GLOBAL_CONFIG_SITE && GLOBAL_CONFIG_SITE.externalLinkWhitelist) || []

  const normalizeUrl = href => {
    try {
      return new URL(href, window.location.href)
    } catch (error) {
      return null
    }
  }

  const isHttpLink = href => /^https?:\/\//i.test(href || '')

  const isWhitelistedHost = hostname => {
    const whitelist = getWhitelist()
    return whitelist.some(item => {
      const value = (item || '').trim()
      return value && (hostname === value || hostname.endsWith(`.${value}`))
    })
  }

  const isExternalLink = anchor => {
    if (!anchor) return false
    const href = anchor.getAttribute('href') || ''
    if (!isHttpLink(href)) return false
    const url = normalizeUrl(href)
    if (!url) return false
    if (url.origin === window.location.origin) return false
    if (isWhitelistedHost(url.hostname)) return false
    return true
  }

  const prepareAppOpenTransition = trigger => {
    if (!trigger || trigger.dataset.pjaxTransition !== 'app-open') return Promise.resolve()

    window.woisolPendingPjaxTransition = {
      type: 'app-open'
    }

    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve()

    const box = document.getElementById('loading-box')
    const surface = box && box.querySelector('.loading-box__app-open')
    if (!box || !surface) return Promise.resolve()

    const transitionName = 'woisol-app-open-surface'
    trigger.style.viewTransitionName = transitionName
    surface.style.background = 'var(--mp-bg-base)'

    const transition = document.startViewTransition(() => {
      box.style.display = 'block'
      box.dataset.state = 'loading'
      box.dataset.phase = 'covering'
      box.dataset.transitionMode = 'app-open'
      box.classList.remove('loaded', 'is-slow')
      trigger.style.viewTransitionName = ''
      surface.style.viewTransitionName = transitionName
      surface.style.transform = 'translate3d(0, 0, 0)'
    })

    return transition.finished.catch(() => {}).finally(() => {
      surface.style.viewTransitionName = ''
      surface.style.background = ''
      surface.style.transform = ''
    })
  }

  const navigateWithPjax = href => {
    if (!href) return
    if (window.pjax && typeof window.pjax.loadUrl === 'function') {
      window.pjax.loadUrl(href)
      return
    }

    window.location.href = href
  }

  const getTooltip = () => {
    if (state.tooltip && document.body.contains(state.tooltip)) return state.tooltip
    state.tooltip = document.getElementById('woisol-link-tooltip')
    return state.tooltip
  }

  const hideTooltip = () => {
    const tooltip = getTooltip()
    if (!tooltip) return
    tooltip.classList.remove('is-visible')
    tooltip.setAttribute('aria-hidden', 'true')
  }

  const showTooltip = anchor => {
    const href = anchor.getAttribute('href') || ''
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return
    if (document.body.classList.contains('woisol-modal-open')) return

    const tooltip = getTooltip()
    if (!tooltip) return
    const url = normalizeUrl(href)
    const host = url ? (url.origin === window.location.origin ? '本站链接' : url.hostname) : '链接'
    const target = url ? url.href : href
    const hostNode = tooltip.querySelector('[data-tooltip-host]')
    const urlNode = tooltip.querySelector('[data-tooltip-url]')

    if (hostNode) hostNode.textContent = host
    if (urlNode) urlNode.textContent = target

    const rect = anchor.getBoundingClientRect()
    const width = Math.min(320, window.innerWidth - 24)
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left + rect.width / 2 - width / 2))
    tooltip.style.left = `${left}px`
    tooltip.classList.add('is-visible')
    tooltip.setAttribute('aria-hidden', 'false')
    tooltip.style.visibility = 'hidden'

    const height = tooltip.offsetHeight || 52
    let top = rect.top - height - 24
    let placement = 'top'

    if (top < 12) {
      top = rect.bottom + 18
      placement = 'bottom'
    }

    tooltip.dataset.placement = placement
    tooltip.style.top = `${top}px`
    tooltip.style.visibility = ''
  }

  const bindExternalModal = modal => {
    if (!modal || modal.dataset.bound === '1') return
    modal.dataset.bound = '1'
    modal.addEventListener('click', event => {
      const actionTarget = event.target.closest('[data-modal-action]')
      if (!actionTarget || !modal.contains(actionTarget)) return

      const action = actionTarget.dataset.modalAction
      if (action === 'cancel') {
        closeExternalModal()
        return
      }

      if (action === 'confirm' && state.activeAnchor) {
        const href = state.activeAnchor.getAttribute('href')
        const target = state.activeAnchor.getAttribute('target') || '_blank'
        closeExternalModal({ restoreFocus: false })
        window.open(href, target, 'noopener')
      }
    })
  }

  const getModal = () => {
    if (state.modal && document.body.contains(state.modal)) return state.modal
    const modal = document.getElementById('woisol-external-modal')
    if (!modal) return null
    bindExternalModal(modal)
    state.modal = modal
    return modal
  }

  const focusExternalModal = modal => {
    const focusTarget = modal.querySelector('[data-modal-action="cancel"]') || modal.querySelector('.woisol-modal__dialog')
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true })
    }
  }

  const isExternalModalOpen = () => {
    const modal = getModal()
    return Boolean(modal && !modal.hidden && document.body.classList.contains('woisol-modal-open'))
  }

  const getModalFocusables = modal => [...modal.querySelectorAll(focusableSelector)].filter(item => {
    if (item.hidden || item.getAttribute('aria-hidden') === 'true') return false
    if ('disabled' in item && item.disabled) return false
    return item.offsetParent !== null || item === document.activeElement
  })

  const closeExternalModal = ({ restoreFocus = true } = {}) => {
    const modal = getModal()
    if (!modal) return
    const restoreTarget = restoreFocus ? (state.lastFocused || state.activeAnchor) : null
    window.clearTimeout(state.modalTimer)
    modal.classList.remove('is-visible')
    modal.setAttribute('aria-hidden', 'true')
    document.body.classList.remove('woisol-modal-open')
    state.modalTimer = window.setTimeout(() => {
      modal.hidden = true
      if (restoreTarget && document.contains(restoreTarget) && typeof restoreTarget.focus === 'function') {
        restoreTarget.focus({ preventScroll: true })
      }
      state.activeAnchor = null
      state.lastFocused = null
    }, 240)
  }

  const openExternalModal = anchor => {
    const modal = getModal()
    if (!modal) return
    const url = normalizeUrl(anchor.getAttribute('href'))
    if (!url) return

    window.clearTimeout(state.modalTimer)
    state.activeAnchor = anchor
    state.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : anchor
    const hostNode = modal.querySelector('[data-modal-host]')
    const urlNode = modal.querySelector('[data-modal-url]')
    if (hostNode) hostNode.textContent = url.hostname
    if (urlNode) urlNode.textContent = url.href
    modal.hidden = false
    modal.setAttribute('aria-hidden', 'false')
    document.body.classList.add('woisol-modal-open')
    hideTooltip()
    window.requestAnimationFrame(() => {
      modal.classList.add('is-visible')
      focusExternalModal(modal)
    })
  }

  const bindArticleLinks = () => {
    const container = document.getElementById('article-container')
    if (!container || container.dataset.woisolLinksBound === '1') return
    container.dataset.woisolLinksBound = '1'

    container.addEventListener('mouseover', event => {
      const anchor = event.target.closest('a[href]')
      if (!anchor || !container.contains(anchor)) return
      if (anchor.querySelector('img')) return
      if (event.relatedTarget && anchor.contains(event.relatedTarget)) return
      showTooltip(anchor)
    })

    container.addEventListener('mouseout', event => {
      const anchor = event.target.closest('a[href]')
      if (!anchor || !container.contains(anchor)) return
      if (event.relatedTarget && anchor.contains(event.relatedTarget)) return
      hideTooltip()
    })

    container.addEventListener('focusin', event => {
      const anchor = event.target.closest('a[href]')
      if (!anchor || !container.contains(anchor)) return
      showTooltip(anchor)
    })

    container.addEventListener('focusout', hideTooltip)

    container.addEventListener('click', event => {
      const anchor = event.target.closest('a[href]')
      if (!anchor || !container.contains(anchor)) return
      if (!isExternalLink(anchor)) return
      event.preventDefault()
      openExternalModal(anchor)
    })
  }

  const bindPjaxTransitions = () => {
    if (state.pjaxTransitionBound) return
    state.pjaxTransitionBound = true

    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = event.target.closest('[data-pjax-transition] a[href]')
      if (!anchor || anchor.target === '_blank') return

      const trigger = anchor.closest('[data-pjax-transition]')
      const url = normalizeUrl(anchor.getAttribute('href'))
      if (!trigger || !url || url.origin !== window.location.origin) return

      event.preventDefault()
      event.stopImmediatePropagation()
      prepareAppOpenTransition(trigger).then(() => navigateWithPjax(url.href))
    }, true)
  }

  const bindBlogsFilters = () => {
    const page = document.getElementById('blogs-page')
    if (!page) return

    const controls = page.querySelector('.blogs-controls')
    if (!controls || controls.dataset.bound === '1') return
    controls.dataset.bound = '1'

    const buttons = [...controls.querySelectorAll('[data-filter]')]
    const showAllTriggers = [...page.querySelectorAll('[data-blogs-action="show-all"]')]
    const topToggles = [...page.querySelectorAll('[data-blogs-action="toggle-top"]')]
    const sectionToggles = [...page.querySelectorAll('[data-blogs-action="toggle-section"]')]
    const sections = [...page.querySelectorAll('[data-blogs-section]')]
    const orderTitle = page.querySelector('[data-blogs-order-title]')
    const orderDesc = page.querySelector('[data-blogs-order-desc]')
    const sortableLists = [...page.querySelectorAll('.recent-posts[data-sortable="true"]')]
    const topList = page.querySelector('.recent-posts[data-collapse-after]')
    const topExtra = page.querySelector('[data-top-extra]')

    const applyTopCollapse = () => {
      if (topExtra) {
        const expanded = topExtra.hidden === false
        topToggles.forEach(toggle => {
          const label = toggle.querySelector('[data-blogs-toggle-label]')
          toggle.classList.toggle('is-expanded', expanded)
          toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false')
          if (label) label.textContent = expanded ? '收起' : '展开'
        })
      }

      if (!topList) return

      const limit = Number(topList.dataset.collapseAfter || 0)
      if (!limit) return

      const expanded = topList.dataset.expanded === 'true'
      const items = [...topList.querySelectorAll('.recent-post-item:not(.ads-wrap)')]

      items.forEach((item, index) => {
        const hidden = !expanded && index >= limit
        item.classList.toggle('is-collapsed-item', hidden)
        item.setAttribute('aria-hidden', hidden ? 'true' : 'false')
      })

      if (topToggles.length) {
        const hiddenCount = Math.max(0, items.length - limit)
        topToggles.forEach(toggle => {
          const label = toggle.querySelector('[data-blogs-toggle-label]')
          toggle.hidden = hiddenCount <= 0
          toggle.classList.toggle('is-expanded', expanded)
          if (label) {
            label.textContent = expanded ? '收起置顶内容' : `展开剩余 ${hiddenCount} 篇`
          }
        })
      }
    }

    const applySort = mode => {
      const sortKey = mode === 'created' ? 'createdTs' : 'updatedTs'

      sortableLists.forEach(container => {
        const list = container.querySelector('.recent-post-items')
        if (!list) return

        const items = [...list.children].filter(item => !item.classList.contains('ads-wrap'))
        items.sort((a, b) => Number(b.dataset[sortKey] || 0) - Number(a.dataset[sortKey] || 0))
        items.forEach(item => list.appendChild(item))
      })

      applyTopCollapse()
    }

    const applyMode = mode => {
      const sortMode = mode === 'created' || mode === 'updated' ? mode : 'updated'
      applySort(sortMode)

      if (orderTitle && orderDesc) {
        if (mode === 'created') {
          orderTitle.textContent = '按创建时间查看全部文章'
          orderDesc.textContent = '忽略 quality 分组，直接按创建时间完整浏览所有文章。'
        } else {
          orderTitle.textContent = '按更新时间查看全部文章'
          orderDesc.textContent = '暂时忽略 quality 分组，直接按更新时间完整浏览所有文章。'
        }
      }

      sections.forEach(section => {
        const sectionType = section.getAttribute('data-blogs-section')
        let visible = true

        if (mode === 'top') {
          visible = sectionType === 'top'
        } else if (mode === 'selected') {
          visible = sectionType === 'selected'
        } else if (mode === 'featured') {
          visible = ['top', 'selected', 'boundary-main'].includes(sectionType)
        } else if (mode === 'updated' || mode === 'created') {
          visible = sectionType === 'chronological'
        } else if (mode === 'all') {
          visible = sectionType !== 'chronological'
        }

        section.hidden = !visible
        section.classList.toggle('is-hidden-section', !visible)
      })

      buttons.forEach(button => {
        button.classList.toggle('is-active', button.dataset.filter === mode)
      })

      controls.dataset.active = mode
    }

    buttons.forEach(button => {
      button.addEventListener('click', () => applyMode(button.dataset.filter))
    })

    showAllTriggers.forEach(button => {
      button.addEventListener('click', () => {
        applyMode('all')
        const target = document.getElementById('blogs-regular-posts') || document.getElementById('blogs-draft-posts')
        target && btf.scrollToDest(btf.getEleTop(target), 300)
      })
    })

    if (topToggles.length && topList) {
      topToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
          topList.dataset.expanded = topList.dataset.expanded === 'true' ? 'false' : 'true'
          applyTopCollapse()
        })
      })
    }

    if (topToggles.length && topExtra) {
      topToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
          topExtra.hidden = !topExtra.hidden
          applyTopCollapse()
        })
      })
    }

    sectionToggles.forEach(toggle => {
      const target = page.querySelector(`#${toggle.dataset.blogsTarget}`)
      if (!target) return

      const applySectionCollapse = () => {
        const expanded = target.hidden === false
        const label = toggle.querySelector('[data-blogs-toggle-label]')
        toggle.classList.toggle('is-expanded', expanded)
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false')
        if (label) label.textContent = expanded ? '收起' : '展开'
      }

      toggle.addEventListener('click', () => {
        target.hidden = !target.hidden
        applySectionCollapse()
      })

      applySectionCollapse()
    })

    applyMode(controls.dataset.default || 'all')
  }

  const bindPostCardLinks = () => {
    const cards = [...document.querySelectorAll('.recent-post-item[data-post-link]')]
    if (!cards.length) return

    const warmUrl = href => {
      if (!href) return
      try {
        const url = new URL(href, window.location.href)
        if (url.origin !== window.location.origin) return
        const key = `prefetch:${url.href}`
        if (document.head.querySelector(`link[data-prefetch-key="${key}"]`)) return

        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = url.href
        link.as = 'document'
        link.dataset.prefetchKey = key
        document.head.appendChild(link)
      } catch (error) {}
    }

    const interactiveSelector = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      'summary',
      'label',
      '[role="button"]',
      '[role="link"]'
    ].join(', ')

    const hasTextSelection = () => {
      const selection = window.getSelection && window.getSelection()
      return Boolean(selection && String(selection).trim())
    }

    cards.forEach(card => {
      if (card.dataset.cardLinkBound === '1') return
      card.dataset.cardLinkBound = '1'

      const navigate = (event, openInNewTab = false) => {
        if (!card.dataset.postLink || event.defaultPrevented) return
        if (event.target.closest(interactiveSelector)) return
        if (hasTextSelection()) return

        if (openInNewTab) {
          window.open(card.dataset.postLink, '_blank', 'noopener')
          return
        }

        prepareAppOpenTransition(card).then(() => navigateWithPjax(card.dataset.postLink))
      }

      card.addEventListener('click', event => {
        if (event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        navigate(event)
      })

      card.addEventListener('auxclick', event => {
        if (event.button !== 1) return
        navigate(event, true)
      })

      card.addEventListener('mouseenter', () => warmUrl(card.dataset.postLink), { passive: true })
      card.addEventListener('focusin', () => warmUrl(card.dataset.postLink))
      card.addEventListener('touchstart', () => warmUrl(card.dataset.postLink), { passive: true, once: true })
    })
  }

  const bindChitFilters = () => {
    const page = document.getElementById('chit-page')
    if (!page) return

    const controls = page.querySelector('.chit-feed__controls')
    if (!controls || controls.dataset.bound === '1') return
    controls.dataset.bound = '1'

    const buttons = [...controls.querySelectorAll('[data-chit-filter]')]
    const cards = [...page.querySelectorAll('[data-chit-visibility]')]

    const applyMode = mode => {
      cards.forEach(card => {
        const visible = mode === 'all' || card.dataset.chitVisibility === mode
        card.hidden = !visible
      })

      buttons.forEach(button => {
        button.classList.toggle('is-active', button.dataset.chitFilter === mode)
      })

      controls.dataset.active = mode
    }

    buttons.forEach(button => {
      button.addEventListener('click', () => applyMode(button.dataset.chitFilter))
    })

    applyMode(controls.dataset.default || 'all')
  }

  const syncCurrentNavState = () => {
    const currentPath = window.location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/'
    const links = document.querySelectorAll('#nav a.site-page[href], #sidebar-menus a.site-page[href]')
    links.forEach(link => {
      const href = (link.getAttribute('href') || '').replace(/index\.html$/, '').replace(/\/+$/, '') || '/'
      const isMatch = href === '/'
        ? currentPath === '/'
        : currentPath === href || currentPath.startsWith(`${href}/`)
      link.classList.toggle('is-current', isMatch)
    })
  }

  const bindReadingProgress = () => {
    if (state.progressBound) return
    state.progressBound = true

    const update = () => {
      const progressBar = document.getElementById('woisol-nav-progress-bar')
      const article = document.getElementById('article-container')
      const nav = document.getElementById('nav')
      const postInfo = document.getElementById('post-info')
      if (!progressBar || !article) return

      const articleTop = article.getBoundingClientRect().top + window.scrollY
      const articleHeight = article.offsetHeight
      const viewport = window.innerHeight
      const start = Math.max(0, articleTop - 96)
      const end = Math.max(start + 1, articleTop + articleHeight - viewport * 0.45)
      const current = window.scrollY
      const percent = Math.max(0, Math.min(100, ((current - start) / (end - start)) * 100))

      progressBar.style.width = `${percent}%`

      if (nav && postInfo && nav.dataset.pageType === 'post') {
        const revealAt = articleTop - 120
        nav.classList.toggle('is-reading', current >= revealAt)
      }
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
  }

  const startRevealObserver = () => {
    if (!state.revealItems.length) return

    if (state.revealObserver) {
      state.revealObserver.disconnect()
    }

    const revealItems = state.revealItems.filter(item => item && !item.classList.contains('is-revealed'))
    if (!revealItems.length) return

    const revealItem = item => {
      const delay = Number(item.dataset.revealDelay || 0)
      item.style.setProperty('--woisol-reveal-delay', `${delay}ms`)
      item.classList.add('is-revealed', 'is-revealing')

      const cleanup = () => {
        item.classList.remove('is-revealing')
        item.style.removeProperty('--woisol-reveal-delay')
      }

      item.addEventListener('animationend', cleanup, { once: true })
      window.setTimeout(cleanup, delay + 760)
    }

    if (!('IntersectionObserver' in window)) {
      revealItems.forEach(item => {
        revealItem(item)
      })
      return
    }

    state.revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const item = entry.target
        revealItem(item)
        state.revealObserver.unobserve(item)
      })
    }, {
      threshold: 0,
      rootMargin: '0px 0px -20px 0px'
    })

    revealItems.forEach(item => state.revealObserver.observe(item))
  }

  const startHeroOrbitAnimation = () => {
    document.querySelectorAll('.home-scene--hero .orbit, .home-scene--hero .keyword, .home-scene--hero .planet').forEach(el => {
      el.style.animationPlayState = 'running'
    })
  }

  const bindScrollReveal = () => {
    const loadingBox = document.getElementById('loading-box')
    const isLoadingVisible = loadingBox
      && loadingBox.style.display !== 'none'
      && loadingBox.dataset.state !== 'done'
      && !loadingBox.classList.contains('loaded')

    if (!state.revealEventBound) {
      state.revealEventBound = true
      window.addEventListener('woisol:loading-finished', () => {
        state.revealReady = true
        startRevealObserver()
        startHeroOrbitAnimation()
      })
    }

    state.revealItems = [...document.querySelectorAll('.woisol-reveal')]
    state.revealReady = !isLoadingVisible
    if (state.revealReady) {
      startRevealObserver()
      startHeroOrbitAnimation()
    }
  }

  // home snap scenes 切换逻辑
  // 用得出 IntersectionObserver 判断是否在视口
  const bindHomeSnapScenes = () => {
    const home = document.querySelector('#home-main[data-home-snap="true"]')
    const root = document.documentElement
    const body = document.body

    const resetHomeState = () => {
      root.classList.remove('woisol-home-snap-root')
      body.classList.remove('woisol-home-snap-page', 'woisol-home-hero-active', 'woisol-home-header-visible')
      delete body.dataset.homeScene
    }

    if (!home) {
      resetHomeState()
      return
    }

    const scenes = [...home.querySelectorAll('[data-home-scene]')]
    if (!scenes.length) {
      resetHomeState()
      return
    }

    root.classList.add('woisol-home-snap-root')
    body.classList.add('woisol-home-snap-page')

    const ratios = new Map()

    const applyActiveScene = sceneName => {
      if (!sceneName) return
      body.dataset.homeScene = sceneName
      body.classList.toggle('woisol-home-hero-active', sceneName === 'hero')
      body.classList.toggle('woisol-home-header-visible', sceneName !== 'hero')
    }

    const getFallbackScene = () => {
      const viewportCenter = window.innerHeight / 2
      let activeScene = scenes[0]
      let minDistance = Number.POSITIVE_INFINITY

      scenes.forEach(scene => {
        const rect = scene.getBoundingClientRect()
        const center = rect.top + rect.height / 2
        const distance = Math.abs(center - viewportCenter)
        if (distance < minDistance) {
          minDistance = distance
          activeScene = scene
        }
      })

      return activeScene
    }

    const updateScene = () => {
      let activeScene = null
      let bestRatio = -1

      scenes.forEach(scene => {
        const ratio = ratios.get(scene) || 0
        if (ratio > bestRatio) {
          bestRatio = ratio
          activeScene = scene
        }
      })

      if (!activeScene || bestRatio < 0.18) {
        activeScene = getFallbackScene()
      }

      applyActiveScene(activeScene.dataset.homeScene || 'hero')
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        ratios.set(entry.target, entry.intersectionRatio)
      })
      updateScene()
    }, {
      threshold: [0, 0.15, 0.35, 0.55, 0.75, 0.95]
    })

    scenes.forEach(scene => observer.observe(scene))
    updateScene()

    // woq，通用 next snap 实现！
    home.querySelectorAll('[data-home-scroll="next"]').forEach(button => {
      if (button.dataset.bound === '1') return
      button.dataset.bound = '1'
      button.addEventListener('click', () => {
        const currentScene = button.closest('[data-home-scene]')
        const index = scenes.indexOf(currentScene)
        const target = scenes[index + 1]
        target && target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  const getEncryptSalts = () => ({
    keySalt: textToArray('hexo-blog-encrypt的作者们都是大帅比!'),
    ivSalt: textToArray('hexo-blog-encrypt是地表最强Hexo加密插件!')
  })

  function textToArray(s) {
    const length = s.length
    let n = 0
    const ba = []

    for (let j = 0; j < length;) {
      const c = s.codePointAt(j)
      if (c < 128) {
        ba[n++] = c
        j++
      } else if (c < 2048) {
        ba[n++] = (c >> 6) | 192
        ba[n++] = (c & 63) | 128
        j++
      } else if (c < 65536) {
        ba[n++] = (c >> 12) | 224
        ba[n++] = ((c >> 6) & 63) | 128
        ba[n++] = (c & 63) | 128
        j++
      } else {
        ba[n++] = (c >> 18) | 240
        ba[n++] = ((c >> 12) & 63) | 128
        ba[n++] = ((c >> 6) & 63) | 128
        ba[n++] = (c & 63) | 128
        j += 2
      }
    }

    return new Uint8Array(ba)
  }

  const hexToArray = s => new Uint8Array((s.match(/[\da-f]{2}/gi) || []).map(h => parseInt(h, 16)))

  const verifyContent = async (key, content, digest) => {
    const encoder = new TextEncoder()
    const encoded = encoder.encode(content)
    const signature = hexToArray(digest)
    return window.crypto.subtle.verify({
      name: 'HMAC',
      hash: 'SHA-256'
    }, key, signature, encoded)
  }

  const getExecutableScript = oldElem => {
    const out = document.createElement('script')
    ;['type', 'text', 'src', 'crossorigin', 'defer', 'referrerpolicy'].forEach(att => {
      if (oldElem[att]) out[att] = oldElem[att]
    })
    return out
  }

  const convertHTMLToElement = async content => {
    const out = document.createElement('div')
    out.innerHTML = content
    const scripts = [...out.querySelectorAll('script')]
    for (const script of scripts) {
      script.replaceWith(getExecutableScript(script))
    }
    return out
  }

  const bindEncryptBlocks = () => {
    const blocks = document.querySelectorAll('#article-container .woisol-encrypt')
    if (!blocks.length || !window.crypto || !window.crypto.subtle) return

    const { keySalt, ivSalt } = getEncryptSalts()
    const knownPrefix = '<hbe-prefix></hbe-prefix>'

    blocks.forEach(block => {
      if (block.dataset.bound === '1') return
      block.dataset.bound = '1'

      const input = block.querySelector('.woisol-encrypt__input')
      const button = block.querySelector('.woisol-encrypt__button')
      const error = block.querySelector('.woisol-encrypt__error')
      const payload = block.querySelector('.woisol-encrypt__payload')
      if (!input || !button || !payload) return

      const { encryptedData } = JSON.parse(payload.textContent || '{}')
      const hmacDigest = payload.dataset.hmacdigest || ''

      const unlock = async () => {
        const password = input.value || ''
        if (!password) return

        error.hidden = true

        try {
          const keyMaterial = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey', 'deriveBits'])

          const hmacKey = await window.crypto.subtle.deriveKey({
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: keySalt.buffer,
            iterations: 1024
          }, keyMaterial, {
            name: 'HMAC',
            hash: 'SHA-256',
            length: 256
          }, true, ['verify'])

          const decryptKey = await window.crypto.subtle.deriveKey({
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: keySalt.buffer,
            iterations: 1024
          }, keyMaterial, {
            name: 'AES-CBC',
            length: 256
          }, true, ['decrypt'])

          const iv = await window.crypto.subtle.deriveBits({
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: ivSalt.buffer,
            iterations: 512
          }, keyMaterial, 16 * 8)

          const decrypted = await window.crypto.subtle.decrypt({
            name: 'AES-CBC',
            iv
          }, decryptKey, hexToArray(encryptedData).buffer)

          const decoded = new TextDecoder().decode(decrypted)
          if (!decoded.startsWith(knownPrefix)) throw new Error('wrong password')

          const valid = await verifyContent(hmacKey, decoded, hmacDigest)
          if (!valid) throw new Error('invalid hmac')

          const content = await convertHTMLToElement(decoded.replace(knownPrefix, ''))
          block.innerHTML = ''
          block.classList.add('is-unlocked')
          block.appendChild(content)

          const relock = document.createElement('button')
          relock.type = 'button'
          relock.className = 'woisol-encrypt__relock'
          relock.textContent = '重新加密'
          relock.addEventListener('click', () => window.location.reload())
          block.appendChild(relock)

          document.querySelectorAll('#article-container img').forEach(elem => {
            if (elem.getAttribute('data-src') && !elem.src) elem.src = elem.getAttribute('data-src')
          })

          window.dispatchEvent(new Event('hexo-blog-decrypt'))
          hideTooltip()
        } catch (err) {
          error.hidden = false
        }
      }

      button.addEventListener('click', unlock)
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') unlock()
      })
    })
  }

  const runAiSummaryReveal = () => {
    const summary = document.querySelector('.post-ai-summary[data-stream="true"] .post-ai-summary__content')
    if (!summary || summary.dataset.bound === '1') return
    summary.dataset.bound = '1'

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const original = summary.textContent.trim()
    if (!original) return

    summary.textContent = ''
    summary.parentElement.classList.add('is-streaming')

    let index = 0
    const step = () => {
      index += Math.max(1, Math.ceil(original.length / 48))
      summary.textContent = original.slice(0, index)

      if (index < original.length) {
        window.setTimeout(step, 18)
      } else {
        summary.parentElement.classList.remove('is-streaming')
      }
    }

    step()
  }

  const init = () => {
    getTooltip()
    getModal()
    bindArticleLinks()
    bindPjaxTransitions()
    bindBlogsFilters()
    bindPostCardLinks()
    bindChitFilters()
    bindHomeSnapScenes()
    bindEncryptBlocks()
    runAiSummaryReveal()
    bindReadingProgress()
    bindScrollReveal()
    syncCurrentNavState()

    if (!state.scrollBound) {
      state.scrollBound = true
      window.addEventListener('scroll', hideTooltip, { passive: true })
    }

    if (!state.globalKeydownBound) {
      state.globalKeydownBound = true
      document.addEventListener('keydown', event => {
        if (!isExternalModalOpen()) return

        if (event.key === 'Escape') {
          event.preventDefault()
          closeExternalModal()
          return
        }

        if (event.key !== 'Tab') return

        const modal = getModal()
        if (!modal) return

        const focusables = getModalFocusables(modal)
        const dialog = modal.querySelector('.woisol-modal__dialog')

        if (!focusables.length) {
          event.preventDefault()
          if (dialog && typeof dialog.focus === 'function') {
            dialog.focus({ preventScroll: true })
          }
          return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (!modal.contains(document.activeElement)) {
          event.preventDefault()
          first.focus({ preventScroll: true })
          return
        }

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus({ preventScroll: true })
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus({ preventScroll: true })
        }
      })
    }
  }

  if (window.btf && typeof btf.addGlobalFn === 'function') {
    btf.addGlobalFn('pjaxComplete', init, 'woisol-ui')
  }

  init()
})()
