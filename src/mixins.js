/* eslint-disable import/no-commonjs */
const postcss = require('postcss');
const postcssJs = require('postcss-js');
const fs = require('fs');
const variables = require('./variables.js');
const _ = require('lodash');
const flatten = require('flat');

module.exports = {
  VARS: {},
  init(options) {
    // Load variables from external files
    const filesWithVars = options.filesWithVars || [];
    const externalVars = {};
    filesWithVars.forEach(filepath => {
      const css = this.cssToObject(fs.readFileSync(filepath, 'utf8'));
      _.each(css[':root'], (value, key) => {
        const varKey = _.kebabCase(key.replace(/^-/, ''));
        externalVars[varKey] = value;
      });
    });

    this.VARS = variables.init(externalVars);

    return {
      render: this.render.bind(this),
      eachPercent: this.mixinEachPercent.bind(this),
      eachColor: this.mixinEachColor.bind(this),
      eachColorAndPercent: this.mixinEachColorAndPercent.bind(this),
      eachGradient: this.mixinEachGradient.bind(this),
      eachGradientAndPercent: this.mixinEachGradientAndPercent.bind(this),
      eachFontAwesome: this.mixinEachFontAwesome.bind(this),
    };
  },

  // Convert a CSS string to a nested object representation
  // Every mixin should return one of those
  cssToObject(css) {
    return postcssJs.objectify(postcss.parse(css));
  },

  // Parses a template passed to the mixin
  // - Remove wrapping " and '
  // - Replace variables with their values
  parseTemplate(rawTemplate) {
    let template = rawTemplate.replace(/^('|")/, '').replace(/('|")$/, '');
    const flattenVars = flatten(this.VARS);
    _.each(flattenVars, (value, key) => {
      template = _.replace(template, new RegExp(`{${key}}`, 'g'), value);
    });
    return template;
  },

  // Renders the passed string to CSS
  render(mixin, rawTemplate) {
    return this.cssToObject(this.parseTemplate(rawTemplate));
  },

  // Apply onEach callback on every color
  eachColor(template, onEach) {
    const rules = [];
    _.each(this.VARS.colors, (value, key) => {
      rules.push(onEach(template, key, value));
    });
    return rules;
  },

  // Apply onEach callback on each percent increment
  eachPercent(template, increment, onEach) {
    const steps = 100 / increment;
    const rules = [];
    _.times(steps, step => {
      const percent = (step + 1) * increment;
      rules.push(onEach(template, percent));
    });
    return rules;
  },

  // Apply onEach callback on every gradient
  eachGradient(template, onEach) {
    const rules = [];
    _.each(this.VARS.gradients, (value, key) => {
      rules.push(onEach(template, key, value.angle, value.start, value.end));
    });
    return rules;
  },

  // Apply onEach callback on every icon from Font Awesome
  eachFontAwesome(template, onEach) {
    const rules = [];
    _.each(this.VARS.fontAwesome, (value, key) => {
      rules.push(onEach(template, key, value));
    });
    return rules;
  },

  // Loop through each color
  mixinEachColor(mixin, rawTemplate) {
    const template = this.parseTemplate(rawTemplate);
    const rules = this.eachColor(template, (input, colorName, colorValue) =>
      template
        .replace(/{colorName}/g, colorName)
        .replace(/{colorValue}/g, colorValue)
    );
    return this.cssToObject(rules.join('\n'));
  },

  // Loop through each percent with the increment given
  mixinEachPercent(mixin, increment, rawTemplate) {
    const template = this.parseTemplate(rawTemplate);
    const rules = this.eachPercent(template, increment, (input, percent) =>
      template.replace(/{percent}/g, percent)
    );
    return this.cssToObject(rules.join('\n'));
  },

  // Loop through each color and percentage
  mixinEachColorAndPercent(mixin, increment, rawTemplate) {
    const template = this.parseTemplate(rawTemplate);
    let rules = this.eachColor(template, (inputColor, colorName, colorValue) =>
      this.eachPercent(inputColor, increment, (inputPercent, percent) => {
        if (percent === 100) {
          return null;
        }
        return inputPercent
          .replace(/{colorName}/g, colorName)
          .replace(/{colorValue}/g, colorValue)
          .replace(/{percent}/g, percent);
      })
    );
    rules = _.compact(_.flatten(rules));
    return this.cssToObject(rules.join('\n'));
  },

  // Loop through each gradient
  mixinEachGradient(mixin, rawTemplate) {
    const template = this.parseTemplate(rawTemplate);
    const rules = this.eachGradient(
      template,
      (input, gradientName, gradientAngle, gradientStart, gradientEnd) =>
        template
          .replace(/{gradientName}/g, gradientName)
          .replace(/{gradientAngle}/g, gradientAngle)
          .replace(/{gradientStart}/g, gradientStart)
          .replace(/{gradientEnd}/g, gradientEnd)
    );
    return this.cssToObject(rules.join('\n'));
  },

  // Loop through each gradient and percentage
  mixinEachGradientAndPercent(mixin, increment, rawTemplate) {
    const template = this.parseTemplate(rawTemplate);
    let rules = this.eachGradient(
      template,
      (
        inputGradient,
        gradientName,
        gradientAngle,
        gradientStart,
        gradientEnd
      ) =>
        this.eachPercent(inputGradient, increment, (inputPercent, percent) => {
          if (percent === 100) {
            return null;
          }
          return inputPercent
            .replace(/{gradientName}/g, gradientName)
            .replace(/{gradientAngle}/g, gradientAngle)
            .replace(/{gradientStart}/g, gradientStart)
            .replace(/{gradientEnd}/g, gradientEnd)
            .replace(/{percent}/g, percent);
        })
    );
    rules = _.compact(_.flatten(rules));
    return this.cssToObject(rules.join('\n'));
  },

  // Loop through each icon of FontAwesome
  mixinEachFontAwesome(mixin, rawTemplate) {
    const template = this.parseTemplate(rawTemplate);
    const rules = this.eachFontAwesome(
      template,
      (input, iconName, iconCode) =>
        template
          .replace(/{iconName}/g, iconName)
          .replace(/{iconCode}/g, iconCode)
    );
    return this.cssToObject(rules.join('\n'));
  },
};
