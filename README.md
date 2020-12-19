## **Mersis Kurumsal bilgi botu**
Bu bot mersis sisteminde firma bilgilerinin sorgulanması için yazılmıştır.
 
#### Çalışma mantığı
Bir express.js ve bir bağımsız node.js yapısından oluşur.
Express.js kısmı kullanıcının isteklerini alır ve bu istekleri veritabanına yazar. Ardından da redis pub/sub aracılığıyla alt node scriptine istek yapar. Node scripti Headless bir browser aracılığı ile mersis sistemine bir insan gibi girer ve firma sorgulaması yaparak detaylı bilgi alır.  Şu anki yapıda redis pub/sub sadece node scriptini tetiklemek için kullanılmıştır.

Sistemin genel İşleyişinde kuyruk yapısı vardır. Kullanıcıların sorguladıkları vergi numaraları bir referans numarasıyla eşleştirilerek sisteme kaydedilir ve eğer başarılı bir sorgulama yapılırsa 30 gün boyunca cachete tutulur. 

Sistemin çalıştırılması için önce `npm install ` çalıştırılarak gerekli kütüphaneler kurulmalıdır ardından da;
 
`node bin/www`

ve 

`node bots/mersis.js`

komutları çalıştırılmalıdır. 

Sistemin sağlıklı işlemesi için tek bir node scripti ayağa kaldırılmalıdır. Her ne kadar çoklu çalıştırlabilir olsa da çoklu hesaptan (veya tekil hesaptan) eş zamanlı sorgulamalar bu versiyonunda desteklenmemektedir.

####Gereksinimler
Projenin çalışması için mysql vertabanı ve redis gereklidir. 


#### Kurulum
`npm install `

Komutu ile gerekli tüm kütüphaneler kurulabilir. 
Ayarlar config.js dosyası içine yazılmalıdır. 
Örnek config.js dosyası projede config.example.js adıyla verilmiştir.

Veritabanı ve sorgulamaların yapılacağı mersis hesap bilgileri girilmelidir.

PUB_SUB_NAME = Redis içinde hangi key ile eventlerin publish edileceğini belirtir.

API_PORT= Apinin hangi porttan ayağa kalkacağını belitir.

PUPPETEER_SLOW_MO= Headless browser'ın işlemleri ne kadarlık bir gecikmeyle yapacağını belirtir. (Botun sağlıklı işlemesi için çok küçük değerlerden kaçının.)

CAPTCHA_SECRET= Captchaları çözmek için anti-captcha.comdan alınmış token 

#### Apiler
Apileri kullanmak için api_users tablosunda bir tanımlama yapılmalıdır. Ordaki private_key token olarak isteğin içinde gönderilmelidir. 

#####Yeni sorgu
Endpoint: /query

tax_number = Vergi numarasını temsil eder. 

token= private_key temsil eder.

Method: "post"

`{
    "token":"1234567890",
    "tax_number":"25840850776"
}`


#####Var olan işlem sorgulama
Endpoint: /check-process

reference = ilgili işlemin sistem tarafından verilen referans numarası. 

token= private_key temsil eder.

Method: "post"

`{
     "token":"1234567890",
     "reference":"2265799859"
 }`



#### Olası hatalar

***KRİTİK***

Mersis sisteminin değişmesi & Tasarımın güncellenmesi veya ekrandaki elementlerin javascript içindeki erişimlerinin değişmesi gibi bir durumda yanlış hatalı bir bilgi gelebilir veya sistem tamamen patlayabilir. Bu tarz durumlarda sistem kendini yeniden başlatarak tekrar denemeyi sürdürecektir. Böyle bir durumda sistemin manuel durdurularak gerekli düzeltmenin yapılması önemlidir.  


***ORTA***

Sistem herhangi bir şekilde captcha doğrulayamaz ise giriş aşamasında 3 defa, içerde 2 defa olmak üzere yeniden dener. Yine yapamaz ise işlemi sonlandırarak google a gider ve tekrar gelip yeniden giriş yaparak dener. 
Bu işlem firma bilgilerine olumlu veya olumsuz ulaşana kadar devam eder.


####RİSKLER

Herhangi bir şekilde mersis sisteminin suistimal edilmesi veya burdaki bilgilerin kötüye kullanılması söz konusu değildir. Yapılan işlem tamamen tarayıcalar üzerinden yapılan kullanıcının manuel bilgileri doldurması işleminin otomatize edilmiş halidir. Burda yapılan işlem Mersis sistemine kaydolunurken kabul edilen gizlilik sözleşmesine aykırı bir durum oluşturmamaktadır. Buna rağmen kullanmak tamamen sizin sorumluluğunuzdadır.


