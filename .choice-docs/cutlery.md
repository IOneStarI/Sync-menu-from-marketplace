# Cutlery

### 🚀 Get
> `GET /menu/:language/cutlery`

Params:
<!-- schema-block-begin:/services/menu/cutlery/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/cutlery/schema:params -->

Response: [Cutlery schema](#cutlery-schema)

### 🚀 Update
> `PUT /menu/:language/cutlery`

Params:
<!-- schema-block-begin:/services/menu/cutlery/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/cutlery/schema:params -->

Payload:

<!-- schema-block-begin:/services/menu/cutlery/schema:payload -->

 Property | Type | Description
 --- | --- | --- | 
**show** * | boolean | Show cutlery modal window
showPersonNumber | boolean | Show cutlery person number counter (false - ask only for yes/no)
requiredCutlery | boolean | Force customer to choose yes/no cutlery
posID | string,null | Internal ID in external POS system
price | number[≥0] | Current price
<!-- schema-block-end:/services/menu/cutlery/schema:payload -->

Response: 204 HTTP code

### Cutlery schema

<!-- schema-block-begin:/services/menu/cutlery/schema:schema -->

 Property | Type | Description
 --- | --- | --- | 
show | boolean | Show cutlery modal window
showPersonNumber | boolean | Show cutlery person number counter (false - ask only for yes/no)
requiredCutlery | boolean | Force customer to choose yes/no cutlery
posID | string,null | Internal ID in external POS system
price | number[≥0] | Current price
<!-- schema-block-end:/services/menu/cutlery/schema:schema -->

