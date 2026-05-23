# (Beta) Full import client menu

### 🚀 You have 2 options to update menu

#### 1. Full update

> `POST /menu/:language/full`

>
> ⚠️ At this method all not listed entities will be deleted.
> 

<br/>

#### 2. Partial update (dishes property only)

> `PATCH /menu/:language/full/dishes`

> 
> 💁 TIP: See below for more examples.
> 


#### Params
<!-- schema-block-begin:/services/menu/full/schema:fullImportParams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/full/schema:fullImportParams -->

#### Payload:
<!-- schema-block-begin:/services/menu/full/schema:importPayload -->

 Property | Type | Description
 --- | --- | --- | 
sections | array[nested schema] | **Section schema**
categories | array[nested schema] | **Category schema**
dishOptions | array[nested schema] | **Dish option schema**
dishes | array[nested schema] | **Dish schema**

#### Section schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string | Internal ID in external POS system
**name** * | string | Name of section
active | boolean | Active section flag
description | string[0,1000] | Description of section
showOutsideSchedule | boolean | Allow to show outside schedule
schedule | array[nested schema],null | **Section schedule schema**

#### Section schedule schema
 Property | Type | Description
 --- | --- | --- | 
dayOfWeek | number[0,6] | Day of the week (0 - Sunday, 1 - Monday)
active | boolean | Is section active in this day
from | string | Time from
till | string | Time till

#### Category schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string | Internal ID in external POS system
**sectionPosID** * | string | Internal ID in external POS system
**name** * | string | Name of category
description | string[0,1000] | Description of category
active | boolean | Active flag

#### Dish option schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string | Internal ID in external POS system
**sectionPosID** * | string | Internal ID in external POS system
**name** * | string | Name of option list
active | boolean | Active flag
type | string<br />Enum: single, multiple | Type of dish option
required | boolean | Is option required
countable | boolean | Is option countable
menuMaxCount | number | Maximum allowed count (0 - no limit)
menuMinCount | number | Minimum allowed count (0 - no limit)
list | array[nested schema] | **Option list schema**

#### Option list schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string | Internal ID in external POS system
**name** * | string | Name of option
price | number[≥0] | Price
active | boolean | Active flag
default | boolean | Is option default
max | number | Maximum allowed count

#### Dish schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string | Internal ID in external POS system
**categoryPosID** * | string | Internal ID in external POS system
**name** * | string | Name of dish
description | string | Description of dish
active | boolean(=true) | Active section flag
price | number[≥0] | Current price (in cents, ex.: 1 USD = 100)
preparationTime | number[≥0] | Preparation time of dish in minutes
VAT | number[0,100] | Dish VAT
weight | string[0, 100] | Weight of dish (in weight type)
weightType | string(=g)<br />Enum: g, kg, mm, m, ml, l, oz, psc | Weight type
attributes | array[string]<br/> Enum: SOLD_OUT | Dish attributes
kcal | number[≥0] | Calories of dish (in kcal)
alcohol | number[0,100] | Alcohol percents (if present)
allergens | array[number] | Allergens (international numbers)
media | string | URL of media
menuLabels | array[nested schema] | **Menu label schema**
dishOptions | array[nested schema] | **Attached dish option schema**

#### Menu label schema
 Property | Type | Description
 --- | --- | --- | 
**type** * | string<br />Enum: vegetarian, gluten, spicy, middle-spicy, recommended, vegan, new, custom | 

#### Attached dish option schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string,null | Internal ID in external POS system
active | boolean | Active flag
list | array[nested schema] | **Attached dish option list schema**

#### Attached dish option list schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string,null | Internal ID in external POS system
active | boolean | Active flag
price | number[≥0] | Override price in this option. Don't recommend
<!-- schema-block-end:/services/menu/full/schema:importPayload -->

#### Response:

Response: 204 HTTP code

### Example:


#### Full import or first import

```json
{
  "sections": [
    {
      "posID": "section-breakfast-posid-1",
      "name": "Breakfast #123",
      "description": "Breakfast description",
      "showOutsideSchedule": true,
      "schedule": [
        {
          "dayOfWeek": 0,
          "active": true,
          "from": "10:00:00",
          "till": "15:00:00"
        },
        {
          "dayOfWeek": 1,
          "active": true,
          "from": "11:00:00",
          "till": "15:00:00"
        },
        {
          "dayOfWeek": 2,
          "active": true,
          "from": "12:00:00",
          "till": "15:00:00"
        },
        {
          "dayOfWeek": 3,
          "active": true,
          "from": "13:00:00",
          "till": "15:00:00"
        },
        {
          "dayOfWeek": 4,
          "active": true,
          "from": "14:00:00",
          "till": "15:00:00"
        },
        {
          "dayOfWeek": 5,
          "active": true,
          "from": "15:00:00",
          "till": "16:00:00"
        },
        {
          "dayOfWeek": 6,
          "active": true,
          "from": "16:00:00",
          "till": "18:00:00"
        }
      ]
    },
    {
      "posID": "section-main-menu-posid-2",
      "name": "Main menu",
      "description": "Menu description"
    },
    {
      "posID": "section-simple-menu-posid-2",
      "name": "Simple menu",
      "description": "Menu description"
    }
  ],
  "categories": [
    {
      "name": "Eggs",
      "posID": "category-eggs-pos-id",
      "sectionPosID": "section-breakfast-posid-1",
      "active": true
    },
    {
      "name": "Milk",
      "posID": "category-milk-pos-id",
      "sectionPosID": "section-breakfast-posid-1",
      "active": true
    },
    {
      "name": "Wine",
      "posID": "category-wine-pos-id",
      "sectionPosID": "section-main-menu-posid-2",
      "active": true
    }
  ],
  "dishOptions": [
    {
      "posID": "pos-id-dish-option 3",
      "sectionPosID": "section-breakfast-posid-1",
      "active": true,
      "type": "single",
      "name": "Topings",
      "list": [
        {
          "name": "No extra",
          "active": true,
          "default": true,
          "price": 0,
          "posID": "posid-dishoption1-listitem31"
        },
        {
          "name": "Beacon",
          "active": true,
          "price": 35000,
          "posID": "posid-dishoption1-listitem32"
        }
      ]
    },
    {
      "posID": "pos-id-dish-option 2",
      "sectionPosID": "section-breakfast-posid-1",
      "active": true,
      "type": "single",
      "required": true,
      "name": "Milk type",
      "list": [
        {
          "name": "Normal milk",
          "active": true,
          "price": 0,
          "posID": "posid-dishoption1-listitem21"
        },
        {
          "name": "Oak milk",
          "active": true,
          "price": 30000,
          "posID": "posid-dishoption1-listitem22"
        }
      ]
    },
    {
      "posID": "pos-id-dish-option 1",
      "sectionPosID": "section-breakfast-posid-1",
      "active": true,
      "type": "multiple",
      "required": true,
      "countable": true,
      "menuMaxCount": 100,
      "menuMinCount": 1,
      "name": "dish option",
      "list": [
        {
          "name": "dish option, list item 1",
          "active": true,
          "price": 20000,
          "posID": "posid-dishoption1-listitem1"
        },
        {
          "name": "dish option, list item 3",
          "active": true,
          "price": 20000,
          "posID": "posid-dishoption1-listitem3"
        },
        {
          "name": "dish option, list item 2",
          "active": true,
          "price": 20000,
          "posID": "posid-dishoption1-listitem2"
        }
      ]
    },
    {
      "posID": "pos-id-dish-option-005",
      "sectionPosID": "section-main-menu-posid-2",
      "active": true,
      "type": "single",
      "required": false,
      "name": "Wine bottle",
      "list": [
        {
          "name": "Normal size",
          "active": true,
          "price": 0,
          "default": true,
          "posID": "posid-dishoption3-listitem21"
        },
        {
          "name": "XXXL size",
          "active": true,
          "price": 30000,
          "posID": "posid-dishoption3-listitem22"
        }
      ]
    }
  ],
  "dishes": [
    {
      "categoryPosID": "category-milk-pos-id",
      "posID": "simple-milk-1",
      "name": "Simple milk",
      "price": 50000,
      "attributes": [
        "SOLD_OUT"
      ]
    },
    {
      "posID": "dish-1-wine1",
      "categoryPosID": "category-wine-pos-id",
      "name": "Good wine",
      "price": 10000,
      "dishOptions": [
        {
          "posID": "pos-id-dish-option-005",
          "list": [
            {
              "posID": "posid-dishoption3-listitem21"
            },
            {
              "posID": "posid-dishoption3-listitem22"
            }
          ]
        }
      ]
    },
    {
      "posID": "dish-1-posid3",
      "categoryPosID": "category-eggs-pos-id",
      "name": "Omlete jam jam",
      "description": "Omlete description",
      "price": 50000,
      "active": false,
      "preparationTime": 20,
      "VAT": 20,
      "weight": "20/20/10",
      "weightType": "g",
      "attributes": [],
      "kcal": 200,
      "alcohol": 40,
      "media": "https://cdn-media.stage-choiceqr.online/stage-eat-taxiavenue/menu/QbEvTDJ-sKbxsAF-XZIbUDC_GKK.jpeg",
      "dishOptions": [
        {
          "posID": "pos-id-dish-option 2",
          "active": true,
          "list": [
            {
              "posID": "posid-dishoption1-listitem21",
              "active": true,
              "price": 4000
            },
            {
              "posID": "posid-dishoption1-listitem22"
            }
          ]
        },
        {
          "posID": "pos-id-dish-option 3",
          "list": [
            {
              "posID": "posid-dishoption1-listitem31"
            },
            {
              "posID": "posid-dishoption1-listitem32"
            }
          ]
        }
      ],
      "menuLabels": [
        {
          "type": "gluten"
        }
      ],
      "allergens": [
        1,
        5,
        10
      ]
    }
  ]
}
```

#### Partial update 

Pass dishes property only

```json
{
  "dishes": [
    {
      "categoryPosID": "category-milk-pos-id",
      "posID": "simple-milk-1",
      "name": "Simple milk",
      "price": 50000,
      "attributes": [
        "SOLD_OUT"
      ]
    }
  ]
}
```

