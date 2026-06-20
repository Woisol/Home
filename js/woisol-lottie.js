(() => {
  const REGISTRY = {
    'arrow-right': {
      provider: 'lottieicon',
      providerId: '1635',
      trigger: 'hover',
      src: '/lottie/Arrow%20Right.json',
      monochrome: true
    },
    'arrow-left': {
      provider: 'lottieicon',
      providerId: '1630',
      trigger: 'hover',
      src: '/lottie/Arrow%20Left.json',
      monochrome: true
    },
    'arrow-up': {
      provider: 'lottieicon',
      providerId: '1640',
      trigger: 'hover',
      src: '/lottie/Arrow%20Up.json',
      monochrome: true
    },
    settings: {
      provider: 'lottieicon',
      providerId: '1599',
      trigger: 'hover',
      src: '/lottie/Setting.json',
      monochrome: true
    },
    'arrow-down': {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Arrow%20Down.json',
      monochrome: true
    },
    book: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Book.json',
      monochrome: true
    },
    bookmark: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Bookmark.json',
      monochrome: true
    },
    calendar: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Calendar.json',
      monochrome: true
    },
    chat: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Chat%2003.json',
      monochrome: true
    },
    email: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Email%20Icon.json',
      monochrome: true
    },
    'face-scanner': {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Face%20Scanner%20Icon.json',
      monochrome: true
    },
    folder: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Folder.json',
      monochrome: true
    },
    list: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Free%20List%20Icon.json',
      monochrome: true
    },
    home: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Home%20Icon.json',
      monochrome: true
    },
    info: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Information.json',
      monochrome: true
    },
    layer: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Layer%20Icon.json',
      monochrome: true
    },
    'light-bulb': {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Light%20Bulb.json',
      monochrome: true
    },
    link: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Link%20Icon.json',
      monochrome: true
    },
    more: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/More%20Square.json',
      monochrome: true
    },
    search: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Search%20Icon.json',
      monochrome: true
    },
    tag: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/Tag.json',
      monochrome: true
    },
    sparkles: {
      provider: 'lottieicon',
      trigger: 'hover',
      src: '/lottie/sparkles.json',
      monochrome: true
    }
  }

  const state = {
    observer: null
  }

  const supportsLottie = () => Boolean(window.lottie && typeof window.lottie.loadAnimation === 'function')

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const getConfig = name => REGISTRY[name] || null

  const getSlotRoot = element => {
    const selector = element.dataset.lottieSlot || ''
    if (!selector) return element
    return element.querySelector(selector) || element
  }

  const getTriggerRoot = element => {
    const selector = element.dataset.lottieTriggerRoot || ''
    if (!selector) return element
    return element.closest(selector) || element
  }

  const buildContainer = (mountRoot, fallback) => {
    const slot = document.createElement('span')
    slot.className = 'woisol-lottie-slot'
    slot.setAttribute('aria-hidden', 'true')

    if (fallback && fallback.parentNode) {
      fallback.parentNode.insertBefore(slot, fallback)
      fallback.classList.add('woisol-lottie-fallback')
    } else {
      mountRoot.prepend(slot)
    }

    return slot
  }

  const playAnimation = animation => {
    if (!animation) return
    try {
      animation.stop()
      animation.goToAndStop(0, true)
      animation.play()
    } catch (error) {}
  }

  const initElement = element => {
    if (!element || element.dataset.lottieBound === '1') return
    element.dataset.lottieBound = '1'

    const name = element.dataset.lottieIcon || ''
    const config = getConfig(name)
    if (!config || !config.src || prefersReducedMotion() || !supportsLottie()) return

    const slotRoot = getSlotRoot(element)
    const fallback = typeof slotRoot.matches === 'function' && slotRoot.matches('i, svg')
      ? slotRoot
      : slotRoot.querySelector('i, svg')
    const mountRoot = fallback && fallback === slotRoot && slotRoot.parentNode
      ? slotRoot.parentNode
      : slotRoot
    const slot = buildContainer(mountRoot, fallback)
    if (config.monochrome) {
      slot.classList.add('is-monochrome')
    }
    const animation = window.lottie.loadAnimation({
      container: slot,
      renderer: 'svg',
      loop: config.loop === true,
      autoplay: false,
      path: config.src
    })

    animation.addEventListener('DOMLoaded', () => {
      fallback && fallback.classList.add('is-hidden')
    })

    const trigger = element.dataset.lottieTrigger || config.trigger || 'hover'
    const triggerRoot = getTriggerRoot(element)
    const reveal = element.dataset.lottieReveal || ''

    if (trigger === 'hover' || trigger === 'both') {
      triggerRoot.addEventListener('mouseenter', () => playAnimation(animation))
      triggerRoot.addEventListener('focusin', () => playAnimation(animation))
    }

    if (trigger === 'click' || trigger === 'both') {
      triggerRoot.addEventListener('click', () => playAnimation(animation))
    }

    if (reveal === 'once') {
      if (!('IntersectionObserver' in window)) {
        playAnimation(animation)
      } else {
        if (!state.observer) {
          state.observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
              if (!entry.isIntersecting) return
              const target = entry.target
              if (target.__woisolLottieAnimation) {
                playAnimation(target.__woisolLottieAnimation)
              }
              state.observer.unobserve(target)
            })
          }, {
            threshold: 0.2
          })
        }

        element.__woisolLottieAnimation = animation
        state.observer.observe(element)
      }
    }
  }

  const init = () => {
    document.querySelectorAll('[data-lottie-icon]').forEach(initElement)
  }

  if (window.btf && typeof btf.addGlobalFn === 'function') {
    btf.addGlobalFn('pjaxComplete', init, 'woisol-lottie')
  }

  window.woisolLottie = {
    init
  }

  init()
})()
