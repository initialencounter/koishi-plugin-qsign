const { apply } = require('./lib/index')
const { Context } = require('koishi')
apply(new Context(),{version:"v1.1.1-dev"})