var CopyWebpackPlugin = require('copy-webpack-plugin');
var defaults = require('lodash.defaults');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var gitsha = require('git-bundle-sha');
var path = require('path');
var webpack = require('webpack');
var BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

var routes = require('./src/routes.json');

var __PRODUCTION__ = process.env.NODE_ENV === 'production';

if (!__PRODUCTION__) {
    routes = routes.concat(require('./src/routes-dev.json'));
}

var VersionPlugin = function (options) {
    this.options = options || {};
    return this;
};
VersionPlugin.prototype.apply = function (compiler) {
    var addVersion = function (compilation, versionId, callback) {
        compilation.assets['version.txt'] = {
            source: function () {return versionId;},
            size: function () {return versionId.length;}
        };
        callback();
    };
    var plugin = this;
    compiler.plugin('emit', function (compilation, callback) {
        var sha = process.env.WWW_VERSION;
        if (!sha) {
            gitsha(plugin.options, function (err, sha) {
                if (err) return callback(err);
                return addVersion(compilation, sha, callback);
            });
        } else {
            return addVersion(compilation, sha, callback);
        }
    });
};

// Prepare all entry points
var entry = {
    common: [
        // Vendor
        'raven-js',
        'react',
        'react-dom',
        'react-intl',
        'redux',
        // Init
        './src/init.js'
    ]
};
routes.forEach(function (route) {
    if (!route.redirect) {
        entry[route.name] = './src/views/' + route.view + '.jsx';
    }
});

// Config
module.exports = {
    entry: entry,
    devtool: __PRODUCTION__ ? 'none' : 'cheap-eval-source-map',
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'js/[name].bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.jsx$/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [['es2015', { modules: false }],'react'],
                            plugins: ['transform-runtime'],
                            env: {
                                production: {
                                    presets: ['react-optimize']
                                }
                            },
                            cacheDirectory: true
                        }
                    }
                ],
                include: path.resolve(__dirname, 'src')
            },
            {
                test: /\.scss$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'postcss-loader',
                    'sass-loader'
                ]
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'postcss-loader'
                ]
            },
            {
                test: /\.(png|jpg|gif|eot|svg|ttf|woff)$/,
                loader: 'url-loader'
            }
        ],
        noParse: /node_modules\/google-libphonenumber\/dist/
    },
    node: {
        fs: 'empty'
    },
    plugins: [
        new VersionPlugin({length: 5}),
        // new BundleAnalyzerPlugin()
    ].concat(routes
        .filter(function (route) {return !route.redirect;})
        .map(function (route) {
            return new HtmlWebpackPlugin(defaults({}, {
                title: route.title,
                filename: route.name + '.html',
                route: route,
                minify: __PRODUCTION__ ? {
                    collapseBooleanAttributes: true,
                    collapseWhitespace: true,
                    conservativeCollapse: true,
                    decodeEntities: true,
                    minifyCSS: true,
                    minifyJS: true,
                    removeAttributeQuotes: true,
                    removeOptionalTags: true,
                    removeComments: true,
                    removeRedundantAttributes: true,
                    removeScriptTypeAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    sortAttributes: true,
                    sortClassName: true,
                    useShortDoctype: true
                } : false
            }, require('./src/template-config.js')));
        })
    ).concat([
        new CopyWebpackPlugin([
            {from: 'static'},
            {from: 'intl', to: 'js'}
        ]),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': '"' + (process.env.NODE_ENV || 'development') + '"',
            'process.env.SENTRY_DSN': '"' + (process.env.SENTRY_DSN || '') + '"',
            'process.env.API_HOST': '"' + (process.env.API_HOST || 'https://api.scratch.mit.edu') + '"',
            'process.env.SCRATCH_ENV': '"'+ (process.env.SCRATCH_ENV || 'development') + '"'
        }),
        new webpack.optimize.CommonsChunkPlugin({
            name: 'common', 
            filename: 'js/common.bundle.js',
            minChunks: function (module, count) {
                // Include in common if more than 70% of chunks use it
                return count / Object.keys(entry).length > 0.7;
            }
        }),
        new webpack.LoaderOptionsPlugin({
            minimize: __PRODUCTION__
        })
    ]).concat(__PRODUCTION__ ? [
        new webpack.optimize.ModuleConcatenationPlugin(),
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false
            },
            sourceMap: true
        })
    ] : [])
};
