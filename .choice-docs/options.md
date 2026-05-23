# Dish options

### 🚀 List
> `GET /menu/:language/options/list/:sectionId`

Params:
<!-- schema-block-begin:/services/menu/options/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
sectionId | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/options/schema:params -->

Response: [List options schema[]](#list-options-schema)

### List options schema
<!-- schema-block-begin:/services/menu/options/schema:shortSchema -->

 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
name | string | Name of option list
active | boolean | Active section flag
position | number | Current position
section | ObjectID | MongoDB objectID (string)
posID | string | Internal ID in external POS system
<!-- schema-block-end:/services/menu/options/schema:shortSchema -->

### 🚀 Create
> `POST /menu/:language/options`

Params:
<!-- schema-block-begin:/services/menu/schema:languageParams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/schema:languageParams -->

Payload:
<!-- schema-block-begin:/services/menu/options/schema:payload -->

 Property | Type | Description
 --- | --- | --- | 
**name** * | string[1,100] | Name of category
**type** * | string<br />Enum: single, multiple | Type of dish option
**section** * | ObjectID | MongoDB objectID (string)
active | boolean(=true) | Active flag
posID | string,null | Internal ID in external POS system
required | boolean | Is option required
countable | boolean | Is option countable only for **multiple** type
menuMinCount | number | Minimum allowed count (0 - no limit) only for **multiple** type
menuMaxCount | number | Maximum allowed count (0 - no limit) only for **multiple** type
optionList | array[nested schema] | **Option list payload schema**

#### Option list payload schema
 Property | Type | Description
 --- | --- | --- | 
**name** * | string | Name of option
active | boolean | Active flag
price | number[≥0] | Price
default | boolean | Is option default
max | number | Maximum allowed count (applied only for **countable** option)
posID | string,null | Internal ID in external POS system
<!-- schema-block-end:/services/menu/options/schema:payload -->

Response: [Dish option schema](#dish-option-schema)


### 🚀 Get one
> `GET /menu/:language/options/:_id`

Params:
<!-- schema-block-begin:/services/menu/options/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/options/schema:idparams -->

Response: [Dish option schema]((#dish-option-schema)

### 🚀 Update
> `PUT /menu/:language/options/:_id`

Params:
<!-- schema-block-begin:/services/menu/options/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/options/schema:idparams -->

Payload:
<!-- schema-block-begin:/services/menu/options/schema:payload -->

 Property | Type | Description
 --- | --- | --- | 
**name** * | string[1,100] | Name of category
**type** * | string<br />Enum: single, multiple | Type of dish option
**section** * | ObjectID | MongoDB objectID (string)
active | boolean(=true) | Active flag
posID | string,null | Internal ID in external POS system
required | boolean | Is option required
countable | boolean | Is option countable only for **multiple** type
menuMinCount | number | Minimum allowed count (0 - no limit) only for **multiple** type
menuMaxCount | number | Maximum allowed count (0 - no limit) only for **multiple** type
optionList | array[nested schema] | **Option list payload schema**

#### Option list payload schema
 Property | Type | Description
 --- | --- | --- | 
**name** * | string | Name of option
active | boolean | Active flag
price | number[≥0] | Price
default | boolean | Is option default
max | number | Maximum allowed count (applied only for **countable** option)
posID | string,null | Internal ID in external POS system
<!-- schema-block-end:/services/menu/options/schema:payload -->

Response: 204 HTTP code

### 🚀 Set dish options position
> `POST /menu/:lang/options/:sectionId/position/bulk`

Body (Array of OptionId):
```angular2html
Example:
[
    "64f0b01705e18e3282dddc8e",
    "64ca2a7175d8dc85b892e535",
    "64f0b01205e18e3282dddc8a",
    "64f0b01505e18e3282dddc8c",    
    "64f0b01905e18e3282dddc90"
]
```

Response: 204 HTTP code

### 🚀 Delete
> `DELETE /menu/:language/options/:_id`

Params:
<!-- schema-block-begin:/services/menu/options/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/options/schema:idparams -->

Response: 204 HTTP code

### 🚀 Attach dish option to dish
> `PUT /menu/:language/options/:_id/attach`

Params:
<!-- schema-block-begin:/services/menu/options/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/options/schema:idparams -->

Payload:
<!-- schema-block-begin:/services/menu/options/schema:attachPayloadSchema -->

 Property | Type | Description
 --- | --- | --- | 
**dish** * | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/options/schema:attachPayloadSchema -->

Response: 204 HTTP code

### 🚀 Detach dish option from dish
> `PUT /menu/:language/options/:_id/detach`

Params:
<!-- schema-block-begin:/services/menu/options/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/options/schema:idparams -->

Payload:
<!-- schema-block-begin:/services/menu/options/schema:attachPayloadSchema -->

 Property | Type | Description
 --- | --- | --- | 
**dish** * | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/options/schema:attachPayloadSchema -->

Response: 204 HTTP code

### Dish option schema

<!-- schema-block-begin:/services/menu/options/schema:schema -->

 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
name | string | Name of option list
active | boolean | Active flag
posID | string,null | Internal ID in external POS system
type | string<br />Enum: single, multiple | Type of dish option
position | number | Current position
countable | boolean | Is option countable
required | boolean | Is option required
menuMinCount | number | Minimum allowed count (0 - no limit)
menuMaxCount | number | Maximum allowed count (0 - no limit)
optionList | array[nested schema] | **Option list schema**
section | ObjectID | MongoDB objectID (string)

#### Option list schema
 Property | Type | Description
 --- | --- | --- | 
**name** * | string | Name of option
_id | ObjectID | MongoDB objectID (string)
price | number[≥0] | Price
active | boolean | Active flag
position | number | Current position
default | boolean | Is option default
max | number | Maximum allowed count
posID | string,null | Internal ID in external POS system
<!-- schema-block-end:/services/menu/options/schema:schema -->

