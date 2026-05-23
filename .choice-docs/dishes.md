# Dishes (menu items)

### 🚀 List
> `GET /menu/:language/dishes/list/:categoryId`

Params:
<!-- schema-block-begin:/services/menu/dishes/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
categoryId | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/dishes/schema:params -->

Response: [List dish schema[]](#list-dish-schema)

#### List dish schema
<!-- schema-block-begin:/services/menu/dishes/schema:shortSchema -->

 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
name | string | Name of category
active | boolean | Active flag
posID | string,null | Internal ID in external POS system
price | number | Current price
hurl | string | Human readable url
position | number | Current position
<!-- schema-block-end:/services/menu/dishes/schema:shortSchema -->

### 🚀 GET by params
> `GET /menu/:language/dishes`

Query params:

`posID` - your internal pos ID

Response: [Dish schema](#dish-schema)

Example:
```curl
https://open-api.choiceqr.com/api/menu/en/dishes?posID=b9e8db61-dbf4-44e8-95ee-57dd3056c624
```


### 🚀 Create
> `POST /menu/:language/dishes`

Params:
<!-- schema-block-begin:/services/menu/schema:languageParams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/schema:languageParams -->

Payload:
<!-- schema-block-begin:/services/menu/dishes/schema:createPayload -->

 Property | Type | Description
 --- | --- | --- | 
**name** * | string[1,300] | Name of dish
**category** * | ObjectID | MongoDB objectID (string)
**price** * | number[≥0] | Current price (in cents, ex.: 1 USD = 100)
description | string[0,3000] | Description of dish
active | boolean(=true) | Active dish flag
attributes | array[string]<br/> Enum: SOLD_OUT | Dish attributes
posID | string[0, 100] | Internal ID in external POS system
preparationTime | number[≥0] | Preparation time of dish in minutes
alcohol | number[0,100] | Alcohol percents (if present)
kcal | number[≥0] | Calories of dish (in kcal)
weight | string[0, 100] | Weight of dish (in weight type)
weightType | string(=g)<br />Enum: g, kg, mm, m, ml, l, oz, psc | Weight type
allergens | array[number] | Allergens (international numbers)
media | string | URL of media
<!-- schema-block-end:/services/menu/dishes/schema:createPayload -->

Response: [Dish schema](#dish-schema)

### 🚀 Get one
> `GET /menu/:language/dishes/:_id`

Params:
<!-- schema-block-begin:/services/menu/dishes/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/dishes/schema:idparams -->

Response: [Dish schema](#dish-schema)

### 🚀 Update
> `PUT /menu/:language/dishes/:_id`

Params:
<!-- schema-block-begin:/services/menu/dishes/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/dishes/schema:idparams -->

Payload:
<!-- schema-block-begin:/services/menu/dishes/schema:updatePayload -->

 Property | Type | Description
 --- | --- | --- | 
**name** * | string[1,300] | Name of dish
**price** * | number[≥0] | Current price (in cents, ex.: 1 USD = 100)
description | string[0,3000] | Description of dish
category | ObjectID | MongoDB objectID (string)
active | boolean(=true) | Active dish flag
attributes | array[string]<br/> Enum: SOLD_OUT | Dish attributes
posID | string[0, 100] | Internal ID in external POS system
preparationTime | number[≥0] | Preparation time of dish in minutes
alcohol | number[0,100] | Alcohol percents (if present)
kcal | number[≥0] | Calories of dish (in kcal)
weight | string[0, 100] | Weight of dish (in weight type)
weightType | string(=g)<br />Enum: g, kg, mm, m, ml, l, oz, psc | Weight type
allergens | array[number] | Allergens (international numbers)
media | string | URL of media
<!-- schema-block-end:/services/menu/dishes/schema:updatePayload -->

Response: 204 HTTP code

### 🚀 Patch dish (partial update only necessary fields)
> `PATCH /menu/:language/dishes/:_id`

Params:
<!-- schema-block-begin:/services/menu/dishes/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/dishes/schema:idparams -->

Payload (any of these fields):
<!-- schema-block-begin:/services/menu/dishes/schema:patchPayload -->

 Property | Type | Description
 --- | --- | --- | 
name | string[1,300] | Name of dish
description | string[0,3000] | Description of dish
active | boolean(=true) | Active dish flag
attributes | array[string]<br/> Enum: SOLD_OUT | Dish attributes
posID | string[0, 100] | Internal ID in external POS system
price | number[≥0] | Current price (in cents, ex.: 1 USD = 100)
preparationTime | number[≥0] | Preparation time of dish in minutes
alcohol | number[0,100] | Alcohol percents (if present)
kcal | number[≥0] | Calories of dish (in kcal)
weight | string[0, 100] | Weight of dish (in weight type)
weightType | string(=g)<br />Enum: g, kg, mm, m, ml, l, oz, psc | Weight type
allergens | array[number] | Allergens (international numbers)
media | string | URL of media
<!-- schema-block-end:/services/menu/dishes/schema:patchPayload -->

Response: 204 HTTP code

### 🚀 Update dish availability

> `PUT /menu/:language/dishes/:_id/areas`

Params:
<!-- schema-block-begin:/services/menu/dishes/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/dishes/schema:idparams -->

Payload:
<!-- schema-block-begin:/services/menu/dishes/schema:dishAreasSyncSchema -->

 Property | Type | Description
 --- | --- | --- | 
takeaway | boolean | Available for takeaway
delivery | boolean | Available for delivery
simple | boolean | Available for tables (dine-in)
readOnly | boolean | Available for read only menu (digital menu)
<!-- schema-block-end:/services/menu/dishes/schema:dishAreasSyncSchema -->

Response: 204 HTTP code

### 🚀 Set dishes position
> `POST /menu/:lang/dishes/:categoryId/position/bulk`

Body (Array of DishId):
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
> `DELETE /menu/:language/dishes/:_id`

Params:
<!-- schema-block-begin:/services/menu/dishes/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/dishes/schema:idparams -->

Response: 204 HTTP code

### Dish schema

<!-- schema-block-begin:/services/menu/dishes/schema:schema -->

 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
name | string | Name of dish
description | string | Description of dish
category | ObjectID | MongoDB objectID (string)
active | boolean(=true) | Active section flag
posID | string,null | Internal ID in external POS system
price | number[≥0] | Current price (in cents, ex.: 1 USD = 100)
preparationTime | number[≥0] | Preparation time of dish in minutes
alcohol | number[0,100] | Alcohol percents (if present)
kcal | number[≥0] | Calories of dish (in kcal)
weight | string[0, 100] | Weight of dish (in weight type)
weightType | string(=g)<br />Enum: g, kg, mm, m, ml, l, oz, psc | Weight type
VAT | number[0,100] | Dish VAT
allergens | array[number] | Allergens (international numbers)
attributes | array[string]<br/> Enum: SOLD_OUT | Dish attributes
menuLabels | array[nested schema] | **Menu label schema**
hurl | string | Human readable url
position | number | Current position
media | nested schema object,null | **Media schema**
externalMedia | array[nested schema],null | **External media schema**

#### Menu label schema
 Property | Type | Description
 --- | --- | --- | 
**type** * | string<br />Enum: vegetarian, gluten, spicy, middle-spicy, recommended, vegan, new, custom | 
_id | ObjectID | MongoDB objectID (string)

#### Media schema
 Property | Type | Description
 --- | --- | --- | 
original | string | Original URL of media
thumbnail | string | Thumbnail URL of media

#### External media schema
 Property | Type | Description
 --- | --- | --- | 
url | string[0, 1000] | URL of external media
type | string<br />Enum: youtube | External media type
<!-- schema-block-end:/services/menu/dishes/schema:schema -->

