for (i = 0; i < design.stories.length; i++) {
  design.stories[i].source = _.sample(_.difference(design.sources))
}
