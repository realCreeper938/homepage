const gulp = require('gulp');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { deleteAsync } = require('del');
const { minify } = require('html-minifier-terser');
const through2 = require('through2');
const cleanCSS = require('gulp-clean-css');
const browserSync = require('browser-sync').create();

// 默认背景（使用 CSS 动画渐变，不再用静态 SVG）
const defaultBgDark = 'none';
const defaultBgLight = 'none';

// 默认 favicon（青底 C 字 SVG）
const defaultFavicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23000000'/%3E%3Crect x='8' y='8' width='84' height='84' fill='none' stroke='%2318d1ff' stroke-width='6'/%3E%3Ctext x='50' y='68' font-size='52' font-family='Arial, sans-serif' font-weight='bold' text-anchor='middle' fill='%2318d1ff'%3EC%3C/text%3E%3C/svg%3E";

// 加载 YAML 配置文件
function loadConfig() {
  const configFile = fs.readFileSync('src/config/site.yaml', 'utf8');
  return yaml.parse(configFile);
}

function generateNavHTML(navConfig) {
  return navConfig.items.map((item, index) => {
    const num = String(index + 1).padStart(2, '0');
    const en = item.en || item.name.toUpperCase();
    return `<a href="${item.href}" rel="me noopener" class="nav-item"><span class="nav-num">${num}</span><span class="nav-label"><span class="nav-en">${en}</span><span class="nav-cn">${item.name}</span></span><i data-feather="${item.icon}" aria-hidden="true"></i></a>`;
  }).join('\n            ');
}

// 生成页脚版权年份 HTML
function generateFooterYear(footerConfig) {
  if (footerConfig.year_start === footerConfig.year_end) {
    return `${footerConfig.year_start}`;
  }
  return `${footerConfig.year_start}-${footerConfig.year_end}`;
}

// 生成 Badge 区块 HTML（无配置时不渲染）
function generateShieldsSection(badges) {
  const contact = (badges.contact || []).filter(Boolean);
  if (!contact.length) return '';
  const items = contact.map(badge => {
    const imgTag = `<img src="${badge.src}" alt="${badge.alt}">`;
    if (badge.link) {
      return `<a href="${badge.link}" target="_blank" rel="noopener noreferrer" role="listitem">${imgTag}</a>`;
    }
    return `<span role="listitem">${imgTag}</span>`;
  }).join('\n              ');
  return `<section class="shields-section" aria-label="Contact Me">
          <h2>Contact Me</h2>
          <div class="shields-grid" role="list">
            ${items}
          </div>
        </section>`;
}

// 渲染 Markdown 并生成 HTML 的任务
function renderMarkdown() {
  // 读取配置文件
  const config = loadConfig();

  // 读取 Markdown 内容
  const markdownContent = fs.readFileSync('src/content/index.md', 'utf8');

  // 将 Markdown 转换为 HTML
  const htmlContent = marked.parse(markdownContent);

  // 读取模板
  let template = fs.readFileSync('src/templates/index.html', 'utf8');

  // 替换占位符
  let finalHtml = template.replace('{{content}}', htmlContent);

  // 替换站点配置
  finalHtml = finalHtml.replace(/{{site\.title}}/g, config.site.title);
  finalHtml = finalHtml.replace(/{{site\.description}}/g, config.site.description);
  finalHtml = finalHtml.replace(/{{site\.author}}/g, config.site.author);
  finalHtml = finalHtml.replace(/{{site\.alias}}/g, config.site.alias);
  finalHtml = finalHtml.replace(/{{site\.keywords}}/g, config.site.keywords);

  // 替换背景图片
  const bgImage = config.site.background_image;
  if (bgImage) {
    const bgCSS = `url('${bgImage}')`;
    finalHtml = finalHtml.replace(/{{site\.background_css}}/g, bgCSS);
    finalHtml = finalHtml.replace(/{{site\.background_css_light}}/g, bgCSS);
    finalHtml = finalHtml.replace(/{{site\.background_blur}}/g, 'none');
    finalHtml = finalHtml.replace(/{{site\.card_background}}/g, 'rgba(0, 0, 0, 0.72)');
  } else {
    finalHtml = finalHtml.replace(/{{site\.background_css}}/g, defaultBgDark);
    finalHtml = finalHtml.replace(/{{site\.background_css_light}}/g, defaultBgLight);
    finalHtml = finalHtml.replace(/{{site\.background_blur}}/g, 'none');
    finalHtml = finalHtml.replace(/{{site\.card_background}}/g, 'rgba(0, 0, 0, 0.55)');
  }

  // 替换 favicon（未配置时使用默认 SVG）
  finalHtml = finalHtml.replace(/{{site\.favicon}}/g, config.site.favicon || defaultFavicon);

  // 替换头像配置
  finalHtml = finalHtml.replace(/{{avatar\.src}}/g, config.avatar.src);
  finalHtml = finalHtml.replace(/{{avatar\.alt}}/g, config.avatar.alt);

  // 替换导航栏
  finalHtml = finalHtml.replace('{{nav}}', generateNavHTML(config.nav));

  // 替换页脚配置
  finalHtml = finalHtml.replace('{{footer.year}}', generateFooterYear(config.footer));
  finalHtml = finalHtml.replace(/{{footer\.copyright_holder}}/g, config.footer.copyright_holder);
  finalHtml = finalHtml.replace(/{{footer\.github_link}}/g, config.footer.github_link);

  // 替换 Badge 配置
  finalHtml = finalHtml.replace('{{shields_section}}', generateShieldsSection(config.badges));

  // 确保 public 目录存在
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public', { recursive: true });
  }

  // 写入生成的 HTML 文件
  fs.writeFileSync('public/index.html', finalHtml);

  return Promise.resolve();
}

// 构建时先清空 public 目录
gulp.task('clean', function() {
  return deleteAsync(['public/*']);
});

// 把404.html也输出到public目录
gulp.task('copy404', function() {
  return gulp.src('src/templates/404.html')
    .pipe(gulp.dest('public'));
});

// 复制静态资源（favicon 等）到 public
gulp.task('copyAssets', function(done) {
  const files = fs.readdirSync('src').filter(f =>
    /\.(png|ico|svg|jpg|jpeg|webp|avif)$/i.test(f));
  files.forEach(f => fs.copyFileSync(path.join('src', f), path.join('public', f)));
  done();
});

// HTML压缩配置 - 使用 html-minifier-terser（支持ES6+）
const htmlMinifyOptions = {
    removeComments: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeEmptyAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    minifyJS: true,
    minifyCSS: true
};

// 创建 gulp 插件来压缩 HTML（使用 html-minifier-terser）
function gulpHtmlMinify(options) {
    return through2.obj(async function(file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file);
        }
        if (file.isStream()) {
            return cb(new Error('Streaming not supported'));
        }
        try {
            const result = await minify(file.contents.toString(), options);
            file.contents = Buffer.from(result);
            cb(null, file);
        } catch (err) {
            cb(err);
        }
    });
}

// 压缩 HTML（用于其他 HTML 文件如 404.html）
function minifyHTML() {
  return gulp.src(['public/**/*.html', '!public/templates/*.html'])
    .pipe(gulpHtmlMinify(htmlMinifyOptions))
    .pipe(gulp.dest('public'));
}

// 压缩生成的 index.html
function minifyGeneratedHTML() {
  return gulp.src('public/index.html')
    .pipe(gulpHtmlMinify(htmlMinifyOptions))
    .pipe(gulp.dest('public'));
}

function minifyCSS() {
  return gulp.src('src/templates/css/**/*.css')
    .pipe(cleanCSS())
    .pipe(gulp.dest('public/css'));
}

// 默认任务：先渲染 Markdown，然后压缩所有资源
gulp.task('default', gulp.series(
  'clean',
  renderMarkdown,
  gulp.parallel(minifyHTML, minifyCSS, 'copy404', 'copyAssets'),
  minifyGeneratedHTML
));

// 构建站点（不清理 public）
const buildSite = gulp.series(
  renderMarkdown,
  gulp.parallel(minifyHTML, minifyCSS, 'copy404', 'copyAssets'),
  minifyGeneratedHTML
);

// 启动本地预览服务器
gulp.task('serve', function(done) {
  browserSync.init({
    server: { baseDir: 'public' },
    open: false,
    notify: false
  });
  done();
});

// 监听源码变化并自动重建、刷新
gulp.task('watch', function() {
  const reload = function(done) {
    browserSync.reload();
    done();
  };
  gulp.watch([
    'src/config/site.yaml',
    'src/content/**/*.md',
    'src/templates/index.html',
    'src/templates/404.html'
  ], gulp.series(buildSite, reload));
  gulp.watch('src/templates/css/**/*.css', gulp.series(minifyCSS, reload));
});

// 开发任务：构建 + 启动预览服务器 + 监听变化
gulp.task('dev', gulp.series('clean', buildSite, 'serve', 'watch'));

// 导出任务供单独使用
exports.renderMarkdown = renderMarkdown;
exports.minifyHTML = minifyHTML;
exports.minifyCSS = minifyCSS;
exports.dev = gulp.series('clean', buildSite, 'serve', 'watch');
exports.default = gulp.series(
  'clean',
  renderMarkdown,
  gulp.parallel(minifyHTML, minifyCSS, 'copy404', 'copyAssets'),
  minifyGeneratedHTML
);
