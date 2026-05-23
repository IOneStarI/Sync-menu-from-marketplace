# Full client menu

### 🚀 List

> `GET /menu/:language/full/list`

#### Params:
<!-- schema-block-begin:/services/menu/full/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/full/schema:params -->

#### Response:
<!-- schema-block-begin:/services/menu/full/schema:schema -->

 Property | Type | Description
 --- | --- | --- | 
sections | array[nested schema] | **Section schema**
categories | array[nested schema] | **Category schema**
menu | array[nested schema] | **Dish schema**

#### Section schema
 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
name | string | Name of section
description | string[0,1000] | Description of section
mode | nested schema object | **Section mode schema**
schedule | array[nested schema],null | **Section schedule schema**
active | boolean | Active section flag
posID | string,null | Internal ID in external POS system
position | number | Current position
isDirectLink | boolean | Is section available only by direct link
showOutsideSchedule | boolean | Allow to show outside schedule

#### Section mode schema
 Property | Type | Description
 --- | --- | --- | 
type | string<br />Enum: static, interactive, link, category | Section mode type
link | string | Section link (if type: interactive)
staticDoc | string,null | 

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
_id | ObjectID | MongoDB objectID (string)
section | ObjectID | MongoDB objectID (string)
name | string | Name of category
description | string[0,1000] | Description of category
posID | string,null | Internal ID in external POS system
hurl | string | Human readable url
position | number | Current position
active | boolean | Active flag

#### Dish schema
 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
category | ObjectID | MongoDB objectID (string)
description | string[0, +],null | Dish description
name | string | Name of dish
active | boolean(=true) | Active section flag
position | number | Current position
price | number[≥0] | Current price (in cents, ex.: 1 USD = 100)
weight | string[0, 100] | Weight of dish (in weight type)
weightType | string(=g)<br />Enum: g, kg, mm, m, ml, l, oz, psc | Weight type
posID | string,null | Internal ID in external POS system
preparationTime | number[≥0] | Preparation time of dish in minutes
alcohol | number[0,100] | Alcohol percents (if present)
attributes | array[string]<br/> Enum: SOLD_OUT | Dish attributes
kcal | number[≥0] | Calories of dish (in kcal)
allergens | array[number] | Allergens (international numbers)
externalMedia | array[nested schema],null | **External media schema**
pack | nested schema object,null | **Pack schema**
media | array[nested schema],null | **Dish media schema**
menuOptions | array[nested schema] | **Menu option schema**
menuLabels | array[nested schema] | **Menu label schema**

#### External media schema
 Property | Type | Description
 --- | --- | --- | 
url | string[0, 1000] | URL of external media
type | string<br />Enum: youtube | External media type

#### Pack schema
 Property | Type | Description
 --- | --- | --- | 
name | string[1, +] | Pack name
cost | number[≥0] | Current price (in cents, ex.: 1 USD = 100)

#### Dish media schema
 Property | Type | Description
 --- | --- | --- | 
url | string | URL for original image
thumbnail | string | URL for thumbnail image
medium | string,null | URL for medium image
big | string,null | URL for big image

#### Menu option schema
 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
required | boolean | 
name | string[1, +] | Menu option name
countable | boolean | Is option countable (ex. 1x, 2x of option)
posID | string,null | Internal ID in external POS system
menuMaxCount | number | Maximum allowed count (0 - no limit)
menuMinCount | number | Minimum allowed count (0 - no limit)
defaultIndex | number[≥-1],null | Default index of option list item (-1 doesn't have default item, null - option is required)
type | string(=single)<br />Enum: single, multiple | Type of dish option
list | array[nested schema] | **Option list item schema**

#### Option list item schema
 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
name | string[1, +] | Menu option name
price | number[≥0] | Current price (in cents, ex.: 1 USD = 100)
default | boolean | Is item default
posID | string,null | Internal ID in external POS system

#### Menu label schema
 Property | Type | Description
 --- | --- | --- | 
**type** * | string<br />Enum: vegetarian, gluten, spicy, middle-spicy, recommended, vegan, new, custom | 
**custom** * | boolean | Is custom label
_id | ObjectID | MongoDB objectID (string)
name | string | Label name
<!-- schema-block-end:/services/menu/full/schema:schema -->

Example:

```json
{
  "sections": [
    {
      "_id": "61d88d7e9184810e7480136e",
      "name": "Section 1 Main",
      "description": "Main dishes",
      "mode": {
        "type": "interactive"
      }
    },
    {
      "_id": "61dda0904b5066a5e0f10619",
      "name": "Section 2 Drinks",
      "description": "",
      "mode": {
        "type": "interactive"
      }
    },
    {
      "_id": "61dea86af42841781b5bdcb4",
      "name": "Lunch menu",
      "description": "",
      "mode": {
        "type": "interactive"
      },
      "schedule": [
        {
          "dayOfWeek": 0,
          "active": true,
          "from": "12:00:00",
          "till": "15:00:00"
        },
        {
          "dayOfWeek": 1,
          "active": true,
          "from": "13:00:00",
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
          "from": "12:00:00",
          "till": "15:00:00"
        },
        {
          "dayOfWeek": 4,
          "active": true,
          "from": "12:00:00",
          "till": "15:00:00"
        },
        {
          "dayOfWeek": 5,
          "active": true,
          "from": "12:00:00",
          "till": "15:00:00"
        },
        {
          "dayOfWeek": 6,
          "active": true,
          "from": "12:00:00",
          "till": "15:00:00"
        }
      ]
    }
  ],
  "categories": [
    {
      "_id": "61dda1244b50660cb0f1061b",
      "section": "61dda0904b5066a5e0f10619",
      "name": "Hot",
      "description": null
    },
    {
      "_id": "61dda2064b50663322f1061e",
      "section": "61dda0904b5066a5e0f10619",
      "name": "Cold",
      "description": null
    },
    {
      "_id": "61dda24d4b50664bdef10620",
      "section": "61d88d7e9184810e7480136e",
      "name": "Dishes",
      "description": "Some description"
    },
    {
      "_id": "61dea86ff4284130995bdcb6",
      "section": "61dea86af42841781b5bdcb4",
      "name": "Soups",
      "description": null
    }
  ],
  "menu": [
    {
      "_id": "61dda1534b506619d4f1061c",
      "price": 1500,
      "category": "61dda1244b50660cb0f1061b",
      "position": 0,
      "weight": 0,
      "weightType": "g",
      "allergens": [],
      "preparationTime": 0,
      "externalMedia": [],
      "posID": "10",
      "name": "Tea",
      "description": null,
      "media": [
        {
          "url": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/qJqmvJk-zLIGANK-GIJabdI.jpeg",
          "thumbnail": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/thumbnail_qJqmvJk-zLIGANK-GIJabdI_v-z-n.jpeg",
          "medium": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/qJqmvJk-zLIGANK-GIJabdI_mDN.jpeg",
          "big": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/qJqmvJk-zLIGANK-GIJabdI.jpeg"
        }
      ],
      "pack": {
        "cost": 1000,
        "name": "Hot pack"
      },
      "menuLabels": [],
      "menuOptions": []
    },
    {
      "_id": "61dda2014b50668c92f1061d",
      "price": 2000,
      "category": "61dda1244b50660cb0f1061b",
      "position": 1,
      "weight": 0,
      "weightType": "ml",
      "kcal": 300,
      "alcohol": 0,
      "allergens": [],
      "preparationTime": 5,
      "externalMedia": [
        {
          "type": "youtube",
          "url": "https://www.youtube.com/watch?v=q-7AaGLpcG4&ab_channel=BaristaMentor"
        }
      ],
      "posID": "20",
      "name": "Coffee",
      "description": null,
      "media": [
        {
          "url": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/xhIeCgw-wBpODJp-fWYCpkD.jpeg",
          "thumbnail": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/thumbnail_xhIeCgw-wBpODJp-fWYCpkD_f-H-I.jpeg",
          "medium": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/xhIeCgw-wBpODJp-fWYCpkD.jpeg",
          "big": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/xhIeCgw-wBpODJp-fWYCpkD.jpeg"
        }
      ],
      "pack": {
        "cost": 1000,
        "name": "Hot pack"
      },
      "menuLabels": [],
      "menuOptions": [
        {
          "_id": "61dda31f6031c66513fa35a1",
          "defaultIndex": 1,
          "name": "Coffee size",
          "countable": false,
          "type": "single",
          "list": [
            {
              "_id": "61dda3144b50666d8bf1062c",
              "name": "S",
              "price": 0,
              "default": false
            },
            {
              "_id": "61dda3144b5066308df1062d",
              "name": "M",
              "price": 0,
              "default": true
            },
            {
              "_id": "61dda3144b50667248f1062e",
              "name": "L",
              "price": 0,
              "default": false
            }
          ]
        },
        {
          "_id": "61dda31e6031c66513fa3586",
          "defaultIndex": 1,
          "name": "Coffee cream",
          "countable": false,
          "type": "single",
          "list": [
            {
              "_id": "61dda7144bb993e2fabd7e49",
              "name": "With cream",
              "price": 0,
              "default": false
            },
            {
              "_id": "61dda7154bb9935810bd7e4a",
              "name": "Without cream",
              "price": 0,
              "default": true
            }
          ]
        }
      ]
    },
    {
      "_id": "61dda2414b5066e0d6f1061f",
      "price": 500,
      "category": "61dda2064b50663322f1061e",
      "position": 0,
      "weight": 0,
      "weightType": "g",
      "allergens": [],
      "preparationTime": 0,
      "externalMedia": [],
      "posID": "55",
      "name": "Water",
      "description": null,
      "media": [
        {
          "url": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/xGCtDmW-AGnfQn-ClXFlXE.jpeg",
          "thumbnail": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/thumbnail_xGCtDmW-AGnfQn-ClXFlXE_n-e-p.jpeg",
          "medium": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/xGCtDmW-AGnfQn-ClXFlXE_WKA.jpeg",
          "big": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/xGCtDmW-AGnfQn-ClXFlXE.jpeg"
        }
      ],
      "pack": null,
      "menuLabels": [],
      "menuOptions": []
    },
    {
      "_id": "61dda2684b50660c67f10621",
      "price": 10000,
      "category": "61dda24d4b50664bdef10620",
      "position": 0,
      "weight": 0,
      "weightType": "g",
      "allergens": [
        8
      ],
      "preparationTime": 0,
      "externalMedia": [],
      "posID": "1",
      "name": "Meat",
      "description": null,
      "media": [
        {
          "url": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/NxeHcCm-jbHVNIR-iiDTKJ.jpeg",
          "thumbnail": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/thumbnail_NxeHcCm-jbHVNIR-iiDTKJ_P-I-L.jpeg",
          "medium": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/NxeHcCm-jbHVNIR-iiDTKJ_aLk.jpeg",
          "big": "https://stage-eat-media.s3.eu-central-1.amazonaws.com/stage-eat-open-api-stage-test/menu/NxeHcCm-jbHVNIR-iiDTKJ.jpeg"
        }
      ],
      "pack": null,
      "menuLabels": [
        {
          "_id": "new",
          "type": "new"
        }
      ],
      "menuOptions": [
        {
          "_id": "61dda2b56031c66513fa2144",
          "defaultIndex": null,
          "name": "Meat stage",
          "countable": false,
          "type": "single",
          "list": [
            {
              "_id": "61dda2854b506660b5f10623",
              "name": "Raw",
              "price": 0,
              "default": false
            },
            {
              "_id": "61dda2854b50665d6cf10624",
              "name": "Medium",
              "price": 0,
              "default": false
            },
            {
              "_id": "61dda2854b50663482f10625",
              "name": "Well done",
              "price": 0,
              "default": false
            }
          ]
        },
        {
          "_id": "61dda2b56031c66513fa2171",
          "defaultIndex": -1,
          "name": "Extra",
          "countable": false,
          "type": "multiple",
          "list": [
            {
              "_id": "61dda2ad4b50663aa1f10627",
              "name": "Potates",
              "price": 1000,
              "default": false
            },
            {
              "_id": "61dda2ad4b5066aca8f10628",
              "name": "Paper",
              "price": 1000,
              "default": false
            },
            {
              "_id": "61dda2ad4b50667b8bf10629",
              "name": "Salt",
              "price": 500,
              "default": false
            }
          ]
        }
      ]
    },
    {
      "_id": "61dea87df4284136fc5bdcb7",
      "price": 1000,
      "category": "61dea86ff4284130995bdcb6",
      "position": 0,
      "weight": 0,
      "weightType": "g",
      "allergens": [],
      "preparationTime": 0,
      "externalMedia": [],
      "posID": "99",
      "name": "Soup of the day",
      "description": null,
      "media": null,
      "pack": null,
      "menuLabels": [],
      "menuOptions": []
    }
  ]
}
```

