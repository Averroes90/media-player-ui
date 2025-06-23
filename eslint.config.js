import vuetify from 'eslint-config-vuetify'

export default vuetify({
  extends: ['prettier'],
  plugins: ['prettier'], 
  rules: {
    'prettier/prettier': 'error'
  }
})