// Name Compatibility Test - Main App
const _t = (k, fb) => (window.i18n?.t(k) !== k ? window.i18n.t(k) : fb);

const mainScreen = document.getElementById('main-screen');
const loadingScreen = document.getElementById('loading-screen');
const resultScreen = document.getElementById('result-screen');
const name1Input = document.getElementById('name1');
const name2Input = document.getElementById('name2');
const btnCalc = document.getElementById('btn-calculate');

// i18n init
(async function initI18n() {
    try {
        await i18n.loadTranslations(i18n.getCurrentLanguage());
        i18n.updateUI();
        const langToggle = document.getElementById('lang-toggle');
        const langMenu = document.getElementById('lang-menu');
        document.querySelector(`[data-lang="${i18n.getCurrentLanguage()}"]`)?.classList.add('active');
        langToggle?.addEventListener('click', () => langMenu.classList.toggle('hidden'));
        document.addEventListener('click', e => {
            if (!e.target.closest('.language-selector')) langMenu?.classList.add('hidden');
        });
        document.querySelectorAll('.lang-option').forEach(opt => {
            opt.addEventListener('click', async () => {
                await i18n.setLanguage(opt.dataset.lang);
                document.querySelectorAll('.lang-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                langMenu.classList.add('hidden');
            });
        });
    } catch (e) { console.warn('i18n init:', e); }
    finally {
        const loader = document.getElementById('app-loader');
        if (loader) { loader.classList.add('hidden'); setTimeout(() => loader.remove(), 300); }
    }
})();

// Enable button when both names filled
function checkInputs() {
    const ok = name1Input.value.trim().length > 0 && name2Input.value.trim().length > 0;
    btnCalc.classList.toggle('enabled', ok);
    btnCalc.disabled = !ok;
}
name1Input.addEventListener('input', checkInputs);
name2Input.addEventListener('input', checkInputs);

// Enter key support
[name1Input, name2Input].forEach(input => {
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !btnCalc.disabled) btnCalc.click();
    });
});

// Calculate
btnCalc.addEventListener('click', () => {
    const n1 = name1Input.value.trim();
    const n2 = name2Input.value.trim();
    if (!n1 || !n2) return;
    showLoading(n1, n2);
    if (typeof gtag === 'function') gtag('event', 'calculate', { event_category: 'name_match' });
});

function show(screen) {
    [mainScreen, loadingScreen, resultScreen].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
    window.scrollTo(0, 0);
}

// Hash function for deterministic results
function hashNames(a, b) {
    // Normalize: sort alphabetically so order doesn't matter much
    const s = (a + '♥' + b).toLowerCase().normalize('NFC');
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return h;
}

// Seeded random from hash
function seededRand(seed) {
    let s = seed;
    return function() {
        s = (s * 1664525 + 1013904223) | 0;
        return (s >>> 0) / 4294967296;
    };
}

function calculateCompatibility(n1, n2) {
    const h = hashNames(n1, n2);
    const rand = seededRand(h);

    // 5 categories: love, friendship, chemistry, communication, future
    const cats = [];
    for (let i = 0; i < 5; i++) {
        cats.push(Math.floor(rand() * 51) + 50); // 50-100
    }

    // Boost: if names share characters, add bonus
    const set1 = new Set(n1.toLowerCase());
    const set2 = new Set(n2.toLowerCase());
    let shared = 0;
    set1.forEach(c => { if (set2.has(c)) shared++; });
    const bonus = Math.min(shared * 3, 15);
    cats[0] = Math.min(99, cats[0] + bonus); // love boost

    // Overall = weighted average
    const weights = [0.3, 0.2, 0.2, 0.15, 0.15];
    const overall = Math.round(cats.reduce((sum, v, i) => sum + v * weights[i], 0));

    return { overall, cats, names: [n1, n2] };
}

function showLoading(n1, n2) {
    show(loadingScreen);
    const bar = document.getElementById('loading-fill');
    const text = document.getElementById('loading-text');
    let progress = 0;

    const messages = [
        _t('loading.msg1', 'Analyzing name energy...'),
        _t('loading.msg2', 'Calculating compatibility...'),
        _t('loading.msg3', 'Measuring chemistry...'),
        _t('loading.msg4', 'Reading destiny patterns...'),
        _t('loading.msg5', 'Finalizing results...')
    ];

    const interval = setInterval(() => {
        progress += Math.random() * 18 + 8;
        if (progress >= 100) {
            progress = 100;
            bar.style.width = '100%';
            clearInterval(interval);
            setTimeout(() => showResult(calculateCompatibility(n1, n2)), 400);
        } else {
            bar.style.width = progress + '%';
        }
        const idx = Math.min(Math.floor(progress / 20), messages.length - 1);
        text.textContent = messages[idx];
    }, 350);
}

function showResult(data) {
    show(resultScreen);

    // Names display
    document.getElementById('result-names').innerHTML =
        `<span class="name">${escHtml(data.names[0])}</span><span class="heart">💗</span><span class="name">${escHtml(data.names[1])}</span>`;

    // Score animation
    const scoreEl = document.getElementById('score-number');
    const ring = document.getElementById('score-ring');
    let current = 0;
    const target = data.overall;
    const circumference = 534;

    const anim = setInterval(() => {
        current += 2;
        if (current >= target) { current = target; clearInterval(anim); }
        scoreEl.textContent = current;
        ring.style.strokeDashoffset = circumference - (circumference * current / 100);
    }, 20);

    // Score color based on value
    const color = target >= 85 ? '#ff4d6d' : target >= 70 ? '#ff8fa3' : target >= 55 ? '#ffa94d' : '#adb5bd';
    ring.style.stroke = color;

    // Label & description
    const { label, desc } = getScoreText(target);
    document.getElementById('score-label').textContent = label;
    document.getElementById('score-desc').textContent = desc;

    // Categories
    const catNames = [
        _t('cat.love', 'Love'),
        _t('cat.friendship', 'Friendship'),
        _t('cat.chemistry', 'Chemistry'),
        _t('cat.communication', 'Communication'),
        _t('cat.future', 'Future')
    ];
    const catEmojis = ['❤️', '🤝', '⚡', '💬', '🔮'];
    const catsEl = document.getElementById('categories');
    catsEl.innerHTML = '';

    data.cats.forEach((score, i) => {
        const div = document.createElement('div');
        div.className = 'cat-item';
        div.innerHTML = `
            <div class="cat-header">
                <span class="cat-name">${catEmojis[i]} ${catNames[i]}</span>
                <span class="cat-score">${score}%</span>
            </div>
            <div class="cat-bar"><div class="cat-bar-fill" data-width="${score}"></div></div>`;
        catsEl.appendChild(div);
    });

    // Animate bars
    setTimeout(() => {
        catsEl.querySelectorAll('.cat-bar-fill').forEach(bar => {
            bar.style.width = bar.dataset.width + '%';
        });
    }, 100);

    // Advice
    const adviceBox = document.getElementById('advice-box');
    const advice = getAdvice(target);
    adviceBox.innerHTML = `<h3>💡 ${_t('result.adviceTitle', 'Relationship Advice')}</h3><p>${advice}</p>`;

    if (typeof gtag === 'function') gtag('event', 'result', { event_category: 'name_match', value: target });
}

function getScoreText(score) {
    if (score >= 90) return {
        label: _t('level.soulmate', 'Soulmate Level!'),
        desc: _t('level.soulmateDesc', 'An extraordinary connection! Your names resonate on the deepest level. This is a rare and powerful bond that transcends the ordinary.')
    };
    if (score >= 80) return {
        label: _t('level.perfect', 'Perfect Match!'),
        desc: _t('level.perfectDesc', 'Your compatibility is outstanding! The energy between your names creates a beautiful harmony. You complement each other naturally.')
    };
    if (score >= 70) return {
        label: _t('level.great', 'Great Chemistry!'),
        desc: _t('level.greatDesc', 'There is a strong connection between you two. With some understanding and effort, this can become something truly special.')
    };
    if (score >= 60) return {
        label: _t('level.good', 'Good Potential'),
        desc: _t('level.goodDesc', 'A solid foundation exists between your names. With patience and communication, this relationship can grow into something meaningful.')
    };
    if (score >= 50) return {
        label: _t('level.interesting', 'Interesting Dynamic'),
        desc: _t('level.interestingDesc', 'Your names create an intriguing dynamic. While different, these differences can be complementary. Embrace what makes you unique together.')
    };
    return {
        label: _t('level.growing', 'Room to Grow'),
        desc: _t('level.growingDesc', 'Every great relationship starts somewhere! Your names suggest there is much to discover about each other. The journey itself is the reward.')
    };
}

function getAdvice(score) {
    if (score >= 85) return _t('advice.high', 'Your connection is naturally strong. Focus on maintaining open communication and never take each other for granted. Plan regular quality time together to keep the spark alive.');
    if (score >= 70) return _t('advice.medium', 'You have great potential together! Try to understand each other\'s love language and make small gestures of appreciation daily. Shared activities can strengthen your bond.');
    if (score >= 55) return _t('advice.low', 'Focus on building trust through honest communication. Find common interests and create shared experiences. Remember that the best relationships are built on effort and understanding.');
    return _t('advice.growing', 'Every connection has its own beauty. Focus on being your authentic self and showing genuine interest in the other person. Great relationships often surprise us when we least expect it.');
}

function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// Share
document.getElementById('btn-share').addEventListener('click', () => {
    const n1 = name1Input.value.trim();
    const n2 = name2Input.value.trim();
    const data = calculateCompatibility(n1, n2);
    const text = _t('share.text', 'Our name compatibility is {score}%! 💕\n{name1} ♥ {name2}\nCheck yours too!')
        .replace('{score}', data.overall)
        .replace('{name1}', n1)
        .replace('{name2}', n2);
    const url = 'https://dopabrain.com/name-match/';

    if (navigator.share) {
        navigator.share({ title: _t('share.title', 'Name Compatibility Test'), text, url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text + '\n' + url)
            .then(() => alert(_t('share.copied', 'Copied to clipboard!')))
            .catch(() => {});
    }
    if (typeof gtag === 'function') gtag('event', 'share', { event_category: 'name_match' });
});

// Retry
document.getElementById('btn-retry').addEventListener('click', () => {
    name1Input.value = '';
    name2Input.value = '';
    checkInputs();
    show(mainScreen);
    name1Input.focus();
});

// Theme
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    themeToggle.textContent = saved === 'light' ? '🌙' : '☀️';
    themeToggle.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeToggle.textContent = next === 'light' ? '🌙' : '☀️';
    });
}
