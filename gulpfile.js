const gulp = require('gulp');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { deleteAsync } = require('del');
const { minify } = require('html-minifier-terser');
const through2 = require('through2');
const cleanCSS = require('gulp-clean-css');

// 默认背景（使用 CSS 动画渐变，不再用静态 SVG）
const defaultBgDark = 'none';
const defaultBgLight = 'none';

// 加载 YAML 配置文件
function loadConfig() {
  const configFile = fs.readFileSync('src/config/site.yaml', 'utf8');
  return yaml.parse(configFile);
}

function generateNavHTML(navConfig) {
  return navConfig.items.map(item => {
    return `<a href="${item.href}" rel="me noopener"><i data-feather="${item.icon}" aria-hidden="true"></i><span class="nav-label">${item.name}</span></a>`;
  }).join('\n            ');
}

// 生成页脚版权年份 HTML
function generateFooterYear(footerConfig) {
  if (footerConfig.year_start === footerConfig.year_end) {
    return `${footerConfig.year_start}`;
  }
  return `${footerConfig.year_start}-${footerConfig.year_end}`;
}

// 生成 Badge HTML
function generateBadgesHTML(badges) {
  return badges.map(badge => {
    const imgTag = `<img src="${badge.src}" alt="${badge.alt}">`;
    if (badge.link) {
      return `<a href="${badge.link}" target="_blank" rel="noopener noreferrer" role="listitem">${imgTag}</a>`;
    }
    return `<span role="listitem">${imgTag}</span>`;
  }).join('\n                    ');
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
  finalHtml = finalHtml.replace('{{badges.contact}}', generateBadgesHTML(config.badges.contact));

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
  gulp.parallel(minifyHTML, minifyCSS, 'copy404'),
  minifyGeneratedHTML
));

// 导出任务供单独使用
exports.renderMarkdown = renderMarkdown;
exports.minifyHTML = minifyHTML;
exports.minifyCSS = minifyCSS;
exports.default = gulp.series(
  'clean',
  renderMarkdown,
  gulp.parallel(minifyHTML, minifyCSS, 'copy404'),
  minifyGeneratedHTML
);
